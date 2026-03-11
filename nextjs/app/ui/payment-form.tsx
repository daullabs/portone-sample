"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import * as PortOne from "@portone/browser-sdk/v2"
import type { Currency } from "@portone/server-sdk/common"
import Image from "next/image"
import { FormEventHandler, useState } from "react"
import { randomId } from "../lib/random"

export type Item = {
  id: string
  name: string
  price: number
  currency: Currency
}

export type PaymentFormProps = {
  item: Item
  storeId: string
  channelKey: string
  completePaymentAction: (paymentId: string) => Promise<PaymentStatus>
}

export type PaymentStatus = {
  status: string
  message?: string
}

export default function PaymentForm({
  item,
  storeId,
  channelKey,
  completePaymentAction,
}: PaymentFormProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: "IDLE",
  })
  const handleClose = () =>
    setPaymentStatus({
      status: "IDLE",
    })
  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setPaymentStatus({
      status: "PENDING",
    })
    const paymentId = randomId()
    const payment = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId,
      customer: {
        fullName: "강지훈",
        email: "kghoon@labordaul.co.kr",
        phoneNumber: "01020190027",
      },
      orderName: item.name,
      totalAmount: item.price,
      currency: item.currency as PortOne.Entity.Currency,
      payMethod: "CARD",
      customData: {
        item: item.id,
      },
    })
    if (payment == null || payment?.code != null) {
      setPaymentStatus({
        status: "FAILED",
        message: payment?.message,
      })
      return
    }
    setPaymentStatus(await completePaymentAction(paymentId))
  }

  const isWaitingPayment = paymentStatus.status !== "IDLE"

  return (
    <div className="container mx-auto px-6">
      <Card className="border-0 shadow-none min-w-0">
        <form onSubmit={handleSubmit} className="flex flex-col justify-between gap-6">
          <CardHeader className="p-0">
            <div className="flex flex-row items-center gap-6 rounded-lg bg-muted/50 p-3">
              <div className="rounded-md bg-muted p-3">
                <Image
                  src={`/${item.id}.png`}
                  alt={item.name}
                  width={66}
                  height={69}
                />
              </div>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-base font-medium">{item.name}</CardTitle>
                <p className="text-lg text-muted-foreground">
                  {item.price.toLocaleString()}원
                </p>
              </div>
            </div>
            <div className="flex flex-row justify-between border-t border-border pt-4 text-lg font-medium">
              <span className="text-muted-foreground">총 구입 가격</span>
              <span>{item.price.toLocaleString()}원</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Button
              type="submit"
              aria-busy={isWaitingPayment}
              disabled={isWaitingPayment}
              className="w-full"
            >
              결제
            </Button>
          </CardContent>
        </form>
      </Card>
      {paymentStatus.status === "FAILED" && (
        <dialog
          open
          className="fixed inset-0 z-50 flex max-h-dvh w-full max-w-[calc(576px-var(--body-padding))] flex-col gap-6 rounded-xl border bg-card p-6 shadow-lg"
        >
          <header>
            <h1 className="text-2xl font-medium">결제 실패</h1>
          </header>
          <p className="text-muted-foreground">{paymentStatus.message}</p>
          <Button type="button" variant="outline" onClick={handleClose} className="self-end">
            닫기
          </Button>
        </dialog>
      )}
      {paymentStatus.status === "PAID" && (
        <dialog
          open
          className="fixed inset-0 z-50 flex max-h-dvh w-full max-w-[calc(576px-var(--body-padding))] flex-col gap-6 rounded-xl border bg-card p-6 shadow-lg"
        >
          <header>
            <h1 className="text-2xl font-medium">결제 성공</h1>
          </header>
          <p className="text-muted-foreground">결제에 성공했습니다.</p>
          <Button type="button" variant="outline" onClick={handleClose} className="self-end">
            닫기
          </Button>
        </dialog>
      )}
      {paymentStatus.status === "VIRTUAL_ACCOUNT_ISSUED" && (
        <dialog
          open
          className="fixed inset-0 z-50 flex max-h-dvh w-full max-w-[calc(576px-var(--body-padding))] flex-col gap-6 rounded-xl border bg-card p-6 shadow-lg"
        >
          <header>
            <h1 className="text-2xl font-medium">가상계좌 발급 완료</h1>
          </header>
          <p className="text-muted-foreground">가상계좌가 발급되었습니다.</p>
          <Button type="button" variant="outline" onClick={handleClose} className="self-end">
            닫기
          </Button>
        </dialog>
      )}
    </div>
  )
}
