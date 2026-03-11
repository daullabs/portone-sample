"use client"

import { getPaymentStatusAction } from "@/app/billing/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { randomId } from "@/lib/random"
import * as PortOne from "@portone/browser-sdk/v2"
import { useCallback, useEffect, useState } from "react"

type Message = { type: "ok" | "error"; text: string } | null

/**
 * 빌링키 발급과 초회결제를 한 번에 처리하는 API 테스트 페이지.
 * KG이니시스 휴대폰 결제, 웰컴페이먼츠 휴대폰 결제 등에서 사용.
 * @see https://developers.portone.io/sdk/ko/v2-sdk/billing-key-and-pay-request?v=v2
 */
export default function BillingKeyAndPayTestPage() {
  const [message, setMessage] = useState<Message>(null)
  const [loading, setLoading] = useState(false)
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [fetchingStatus, setFetchingStatus] = useState(false)

  const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? ""
  // 빌링 전용 채널이 없으면 결제 채널 키 사용 (같은 채널로 테스트 가능)
  const channelKey =
    process.env.NEXT_PUBLIC_BILLING_CHANNEL_KEY ??
    ""

  const [orderName, setOrderName] = useState("휴대폰 결제 테스트")
  const [totalAmount, setTotalAmount] = useState("1000")
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW")
  const [productType, setProductType] = useState<
    "PRODUCT_TYPE_REAL" | "PRODUCT_TYPE_DIGITAL"
  >("PRODUCT_TYPE_DIGITAL")
  const [customer, setCustomer] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  })

  const startBillingKeyAndPay = useCallback(async () => {
    if (!storeId || !channelKey) {
      setMessage({
        type: "error",
        text: "NEXT_PUBLIC_STORE_ID, NEXT_PUBLIC_BILLING_CHANNEL_KEY를 설정해주세요.",
      })
      return
    }
    const name = customer.fullName.trim()
    const email = customer.email.trim()
    const phone = customer.phoneNumber.trim().replace(/\D/g, "")
    if (!name || !email || !phone) {
      setMessage({
        type: "error",
        text: "KG이니시스·웰컴페이먼츠 휴대폰 결제 시 구매자 이름, 이메일, 휴대전화번호는 필수입니다.",
      })
      return
    }
    const amount = Number(totalAmount)
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage({ type: "error", text: "결제 금액은 양의 정수여야 합니다." })
      return
    }
    setMessage(null)
    setPaymentStatus(null)
    setLoading(true)
    const paymentId = `billing-and-pay-${randomId()}`
    setLastPaymentId(paymentId)

    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const redirectUrl = `${baseUrl}/billing-and-pay`

    try {
      const res = await PortOne.requestIssueBillingKeyAndPay({
        storeId,
        channelKey,
        paymentId,
        orderName: orderName.trim() || "휴대폰 결제",
        totalAmount: amount,
        currency: currency as PortOne.Entity.Currency,
        billingKeyAndPayMethod: "MOBILE",
        redirectUrl,
        productType,
        customer: {
          fullName: name,
          email,
          phoneNumber: phone,
        },
      })

      if (res?.code != null) {
        setMessage({
          type: "error",
          text: res.message ?? "빌링키 발급 및 결제에 실패했습니다.",
        })
        return
      }
      setLastPaymentId(res.paymentId)
      setMessage({
        type: "ok",
        text: `빌링키 발급 및 결제가 완료되었습니다. (billingKey: ${res.billingKey.slice(0, 24)}…)`,
      })
      setPaymentStatus("결제 완료됨 (클라이언트 응답)")
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [
    storeId,
    channelKey,
    orderName,
    totalAmount,
    currency,
    productType,
    customer.fullName,
    customer.email,
    customer.phoneNumber,
  ])

  const fetchPaymentStatus = useCallback(async () => {
    if (!lastPaymentId) return
    setMessage(null)
    setFetchingStatus(true)
    try {
      const result = await getPaymentStatusAction(lastPaymentId)
      if (result.success) {
        setPaymentStatus(String(result.status))
        setMessage({ type: "ok", text: "결제 상태를 조회했습니다." })
      } else {
        setMessage({ type: "error", text: result.error })
      }
    } finally {
      setFetchingStatus(false)
    }
  }, [lastPaymentId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const paymentId = params.get("paymentId")
    if (paymentId) {
      setLastPaymentId(paymentId)
      setMessage({
        type: "ok",
        text: "결제 후 돌아왔습니다. 아래 '결제 상태 조회'로 서버 상태를 확인하세요.",
      })
      window.history.replaceState({}, "", "/billing-and-pay")
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          빌링키 발급 + 초회결제 테스트 (휴대폰 소액결제)
        </h1>
        <p className="text-sm text-muted-foreground">
          빌링키 발급과 첫 결제를 한 번에 처리합니다. KG이니시스 휴대폰 결제,
          웰컴페이먼츠 휴대폰 결제 등에서 사용합니다.{" "}
          <a
            href="https://developers.portone.io/sdk/ko/v2-sdk/billing-key-and-pay-request?v=v2"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            requestIssueBillingKeyAndPay 요청 형식
          </a>
        </p>
      </header>

      {message && (
        <div
          className={
            message.type === "ok"
              ? "rounded-md bg-green-500/10 p-3 text-sm text-green-800 dark:text-green-200"
              : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>결제 정보</CardTitle>
          <CardDescription>
            주문명, 금액, 통화, 상품 유형(휴대폰 결제 시 필수)을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="order-name">주문명</Label>
            <Input
              id="order-name"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="휴대폰 결제 테스트"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total-amount">결제 금액</Label>
            <Input
              id="total-amount"
              type="number"
              min={1}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="1000"
            />
          </div>
          <div className="space-y-2">
            <Label>통화</Label>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as "KRW" | "USD")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KRW">KRW</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>상품 유형 (휴대폰 빌링키 발급 시 필수)</Label>
            <Select
              value={productType}
              onValueChange={(v) =>
                setProductType(v as "PRODUCT_TYPE_REAL" | "PRODUCT_TYPE_DIGITAL")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT_TYPE_REAL">실물 (REAL)</SelectItem>
                <SelectItem value="PRODUCT_TYPE_DIGITAL">
                  디지털 (DIGITAL)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>구매자 정보 (필수)</CardTitle>
          <CardDescription>
            KG이니시스·웰컴페이먼츠 휴대폰 결제 시 이름, 이메일, 휴대전화번호가
            필수입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="customer-name">이름</Label>
            <Input
              id="customer-name"
              value={customer.fullName}
              onChange={(e) =>
                setCustomer((p) => ({ ...p, fullName: e.target.value }))
              }
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">이메일</Label>
            <Input
              id="customer-email"
              type="email"
              value={customer.email}
              onChange={(e) =>
                setCustomer((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="buyer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-phone">휴대전화번호</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={customer.phoneNumber}
              onChange={(e) =>
                setCustomer((p) => ({ ...p, phoneNumber: e.target.value }))
              }
              placeholder="01012345678"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. 빌링키 발급 + 초회결제 요청</CardTitle>
          <CardDescription>
            휴대폰 결제창이 열리고, 빌링키 발급과 동시에 첫 결제가 진행됩니다.
            리다이렉트 방식이므로 완료 후 이 페이지로 돌아옵니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={startBillingKeyAndPay}
            disabled={loading || !storeId || !channelKey}
          >
            {loading ? "결제창 열림…" : "빌링키 발급 + 결제 시작"}
          </Button>
          {lastPaymentId && (
            <p className="text-xs text-muted-foreground">
              마지막 결제 ID:{" "}
              <code className="rounded bg-muted px-1">{lastPaymentId}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 결제 상태 조회</CardTitle>
          <CardDescription>
            서버에서 결제 상태를 조회합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="secondary"
            onClick={fetchPaymentStatus}
            disabled={!lastPaymentId || fetchingStatus}
          >
            {fetchingStatus ? "조회 중…" : "결제 상태 조회"}
          </Button>
          {paymentStatus != null && (
            <p className="text-sm text-muted-foreground">
              상태: <strong>{paymentStatus}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
