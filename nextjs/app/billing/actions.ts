"use server"

import { PaymentClient } from "@portone/server-sdk/payment"
import type { Currency } from "@portone/server-sdk/common"
import { GetPaymentError } from "@portone/server-sdk/payment"

const portone = PaymentClient({ secret: process.env.V2_API_SECRET! })
const channelKey = process.env.NEXT_PUBLIC_BILLING_CHANNEL_KEY!
const storeId = process.env.NEXT_PUBLIC_STORE_ID!

export type CustomerForm = {
  id?: string
  fullName?: string
  email?: string
  phoneNumber?: string
}

function toCustomerInput(customer?: CustomerForm | null) {
  if (!customer?.fullName && !customer?.email && !customer?.phoneNumber && !customer?.id)
    return undefined
  return {
    id: customer.id,
    name: customer.fullName ? { full: customer.fullName } : undefined,
    email: customer.email || undefined,
    phoneNumber: customer.phoneNumber || undefined,
  }
}

/** API 방식 빌링키 발급 (서버에서 포트원 API 호출) */
export async function issueBillingKeyByApi(form: {
  customerId: string
  fullName: string
  email: string
  phoneNumber: string
  cardNumber: string
  expiryYear: string
  expiryMonth: string
  birthOrBusinessRegistrationNumber?: string
  passwordTwoDigits?: string
}) {
  const cardNum = form.cardNumber.replace(/\s/g, "")
  console.log("[빌링키 API] 서버: issueBillingKeyByApi 호출됨", {
    customerId: form.customerId,
    fullName: form.fullName,
    email: form.email ? "(있음)" : "(없음)",
    phoneNumber: form.phoneNumber ? "(있음)" : "(없음)",
    cardNumberLength: cardNum.length,
    expiryYear: form.expiryYear,
    expiryMonth: form.expiryMonth,
    channelKey: channelKey ? "(설정됨)" : "(없음)",
    storeId: storeId ? "(설정됨)" : "(없음)",
  })
  try {
    const res = await portone.billingKey.issueBillingKey({
      channelKey,
      storeId,
      method: {
        card: {
          credential: {
            number: cardNum,
            expiryYear: form.expiryYear,
            expiryMonth: form.expiryMonth,
            birthOrBusinessRegistrationNumber: form.birthOrBusinessRegistrationNumber || undefined,
            passwordTwoDigits: form.passwordTwoDigits || undefined,
          },
        },
      },
      customer: {
        id: form.customerId,
        name: form.fullName ? { full: form.fullName } : undefined,
        email: form.email || undefined,
        phoneNumber: form.phoneNumber || undefined,
      },
    })
    const billingKey = res.billingKeyInfo.billingKey
    console.log("[빌링키 API] 서버: 빌링키 발급 성공", {
      billingKeyPrefix: billingKey.slice(0, 24) + "…",
    })
    return { success: true as const, billingKey }
  } catch (e) {
    const message = (() => {
      const err = e as Error & { data?: { pgMessage?: string; pgCode?: string; type?: string } }
      if (err?.data?.pgMessage) return err.data.pgMessage
      if (e instanceof Error) return e.message || e.name || String(e)
      if (typeof e === "object" && e !== null && "message" in e)
        return String((e as { message?: unknown }).message)
      if (typeof e === "object" && e !== null) {
        try {
          const str = JSON.stringify(e)
          if (str !== "{}") return str
        } catch {
          // ignore
        }
      }
      return String(e)
    })() || "(알 수 없는 오류)"
    console.error("[빌링키 API] 서버: 빌링키 발급 실패", { error: message, raw: e })
    return { success: false as const, error: message }
  }
}

/** 빌링키로 즉시 결제 */
export async function payWithBillingKeyAction(form: {
  paymentId: string
  billingKey: string
  orderName: string
  amount: number
  currency: string
  customer?: CustomerForm | null
}) {
  try {
    await portone.payWithBillingKey({
      paymentId: form.paymentId,
      billingKey: form.billingKey,
      orderName: form.orderName,
      amount: { total: form.amount },
      currency: form.currency as Currency,
      customer: toCustomerInput(form.customer),
    })
    return { success: true as const }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { success: false as const, error: message }
  }
}

/** 결제 상태 조회 (테스트용) */
export async function getPaymentStatusAction(paymentId: string) {
  try {
    const payment = await portone.getPayment({ paymentId })
    return { success: true as const, status: payment.status }
  } catch (e) {
    if (e instanceof GetPaymentError) {
      return { success: false as const, error: "결제를 찾을 수 없습니다." }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { success: false as const, error: message }
  }
}

/** 결제 예약 */
export async function schedulePaymentAction(form: {
  paymentId: string
  billingKey: string
  orderName: string
  amount: number
  currency: string
  timeToPay: string
  customer?: CustomerForm | null
}) {
  try {
    await portone.paymentSchedule.createPaymentSchedule({
      paymentId: form.paymentId,
      payment: {
        billingKey: form.billingKey,
        orderName: form.orderName,
        amount: { total: form.amount },
        currency: form.currency as Currency,
        customer: toCustomerInput(form.customer),
      },
      timeToPay: form.timeToPay,
    })
    return { success: true as const }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { success: false as const, error: message }
  }
}
