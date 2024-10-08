<script setup lang="ts">
import RoomStatus from './components/RoomStatus.vue'
import RoomAction from './components/RoomAction.vue'
import RoomMessage from './components/RoomMessage.vue'
import { io, Socket } from 'socket.io-client'
import { nextTick, onMounted, onUnmounted, provide } from 'vue'
import { baseURL } from '@/utils/request'
import { useUserStore } from '@/stores'
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import type { Message, TimeMessages } from '@/types/room'
import { MsgType, OrderType } from '@/enums'
import type { ConsultOrderItem, Image } from '@/types/consult'
import { getConsultOrderDetail } from '@/services/consult'
import dayjs from 'dayjs'
import { showToast } from 'vant'

// 获取问诊详情
const consult = ref<ConsultOrderItem>()

const loadConsult = async () => {
  const res = await getConsultOrderDetail(route.query.orderId as string)
  consult.value = res.data
}

// 信息数组
const list = ref<Message[]>([])

const store = useUserStore()
const route = useRoute()
const initialMsg = ref(true)
let socket: Socket
onMounted(() => {
  //获取订单详情
  loadConsult()

  socket = io(baseURL, {
    auth: {
      token: `Bearer ${store.user?.token}`
    },
    query: {
      orderId: route.query.orderId
    }
  })
  socket.on('connect', () => {})
  socket.on('disconnect', () => {})
  socket.on('error', (err) => {
    console.log('error', err)
  })
  // 获取聊天记录
  socket.on('chatMsgList', ({ data }: { data: TimeMessages[] }) => {
    // 准备转换常规消息列表
    const arr: Message[] = []
    data.forEach((item, i) => {
      if (i === 0) time.value = item.createTime
      arr.push({
        msgType: MsgType.Notify,
        msg: { content: item.createTime },
        createTime: item.createTime,
        id: item.createTime
      })
      arr.push(...item.items)
    })
    // 追加到聊天消息列表
    list.value.unshift(...arr)

    //上拉加载信息
    loading.value = false
    if (!arr.length) return showToast('没有更多信息了')

    //第一次加载信息列表
    if (initialMsg.value) {
      // 已读消息
      socket.emit('updateMsgStatus', arr[arr.length - 1].id)
      nextTick(() => {
        window.scrollTo(0, document.body.scrollHeight)
        initialMsg.value = false
      })
    }
  })
  // 问诊室状态改变再次获取订单详情
  socket.on('statusChange', () => loadConsult())

  // 接收消息
  socket.on('receiveChatMsg', async (event) => {
    //已读消息
    socket.emit('updateMsgStatus', event.id)
    list.value.push(event)
    await nextTick()
    window.scrollTo(0, document.body.scrollHeight)
  })
})
onUnmounted(() => {
  socket.close()
})

//发送文本文字
const onSendText = (text: string) => {
  // 发送信息需要  发送人  收消息人  消息类型  消息内容
  socket.emit('sendChatMsg', {
    from: store.user?.id,
    to: consult.value?.docInfo?.id,
    msgType: MsgType.MsgText,
    msg: { content: text }
  })
}

// 发送图片
const onSendImage = (image: Image) => {
  socket.emit('sendChatMsg', {
    from: store.user?.id,
    to: consult.value?.docInfo?.id,
    msgType: MsgType.MsgImage,
    msg: { picture: image }
  })
}

//下拉刷新
const loading = ref(false)
const time = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
const onRefresh = () => {
  socket.emit('getChatMsgList', 20, time.value, consult.value?.id)
}

// 提供后代需要的订单信息
provide('consult', consult)
// 提供修改信息的函数
const completeEva = (score: number) => {
  const item = list.value.find((item) => item.msgType === MsgType.CardEvaForm)
  if (item) {
    item.msg.evaluateDoc = { score }
    item.msgType = MsgType.CardEva
  }
}
provide('completeEva', completeEva)
</script>

<template>
  <div class="room-page">
    <cp-nav-bar title="问诊室"> </cp-nav-bar>
    <!-- 状态栏 -->
    <room-status
      :status="consult?.status"
      :countdown="consult?.countdown"
    ></room-status>

    <van-pull-refresh v-model="loading" @refresh="onRefresh">
      <!-- 消息 -->
      <room-message
        v-for="item in list"
        :key="item.id"
        :item="item"
      ></room-message>
    </van-pull-refresh>

    <!-- 操作栏 -->
    <room-action
      :disabled="consult?.status !== OrderType.ConsultChat"
      @send-text="onSendText"
      @send-image="onSendImage"
    ></room-action>
  </div>
</template>

<style lang="scss" scoped>
.room-page {
  padding-top: 90px;
  padding-bottom: 60px;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: var(--cp-bg);
  .van-pull-refresh {
    width: 100%;
    min-height: calc(100vh - 150px);
  }
}
</style>
