import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import {
  cancelOrder,
  deleteOrder,
  followOrUnfollow,
  getPrescriptionPic
} from '@/services/consult'
import type { ConsultOrderItem, FollowType } from '@/types/consult'
import {
  showFailToast,
  showImagePreview,
  showSuccessToast,
  showToast,
  type FormInstance
} from 'vant'
import { OrderType } from '@/enums'
import type { OrderDetail } from '@/types/order'
import { getMedicalOrderDetail } from '@/services/order'
import { sendMobileCode } from '@/services/user'
import type { CodeType } from '@/types/user'

// 封装逻辑，规范 useXxx，表示使用某功能
export const useFollow = (type: FollowType = 'doc') => {
  const loading = ref(false)
  // {a, b} 类型，传值得时候 {a, b, c} 也可以，这是类型兼容：多的可以给少的
  const follow = async (item: { id: string; likeFlag: 0 | 1 }) => {
    loading.value = true
    try {
      await followOrUnfollow(item.id, type)
      item.likeFlag = item.likeFlag === 1 ? 0 : 1
    } finally {
      loading.value = false
    }
  }
  return { loading, follow }
}

// 封装查看处方逻辑
export const useShowPrescription = () => {
  const onShowPrescription = async (id?: string) => {
    if (id) {
      const res = await getPrescriptionPic(id)
      showImagePreview([res.data.url])
    }
  }
  return { onShowPrescription }
}

// 取消订单
export const useCancelOrder = () => {
  const loading = ref(false)
  const cancelConsultOrder = async (item: ConsultOrderItem) => {
    try {
      loading.value = true
      await cancelOrder(item.id)
      item.status = OrderType.ConsultCancel
      item.statusValue = '已取消'
      showSuccessToast('取消成功')
    } catch (error) {
      showFailToast('取消失败')
    } finally {
      loading.value = false
    }
  }
  return { loading, cancelConsultOrder }
}

// 删除订单
export const useDeleteOrder = (cb: () => void) => {
  // 删除订单
  const deleteLoading = ref(false)
  const deleteConsultOrder = async (item: ConsultOrderItem) => {
    try {
      deleteLoading.value = true
      await deleteOrder(item.id)
      showSuccessToast('删除成功')
      // 成功，做其他业务
      cb && cb()
    } catch (e) {
      showFailToast('删除失败')
    } finally {
      deleteLoading.value = false
    }
  }
  return { deleteLoading, deleteConsultOrder }
}

// 获取订单详情
export const useOrderDetail = (id: string) => {
  const loading = ref(false)
  const order = ref<OrderDetail>()
  onMounted(async () => {
    loading.value = true
    try {
      const res = await getMedicalOrderDetail(id)
      order.value = res.data
    } finally {
      loading.value = false
    }
  })
  return { order, loading }
}

//发送短信验证码
export const useMobileCode = (
  mobile: Ref<string>,
  type: CodeType = 'login'
) => {
  const time = ref(0)
  const form = ref<FormInstance>()
  let timer: number
  const onSend = async () => {
    if (time.value > 0) return
    //验证手机号
    await form.value?.validate('mobile')
    await sendMobileCode(mobile.value, type)
    showToast('发送成功')
    time.value = 60
    //开启倒计时
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      time.value--
      if (time.value <= 0) clearInterval(timer)
    }, 1000)
  }
  onUnmounted(() => {
    clearInterval(timer)
  })

  return { time, onSend, form }
}
