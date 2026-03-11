"use client"

import * as PortOne from "@portone/browser-sdk/v2"
import { randomId } from "@/lib/random"
import {
  issueBillingKeyByApi,
  payWithBillingKeyAction,
  getPaymentStatusAction,
  schedulePaymentAction,
  type CustomerForm,
} from "./actions"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const BILLING_KEYS_STORAGE_KEY = "portone-billing-keys"

type StoredBillingKey = {
  billingKey: string
  issuedAt: string
  customerId?: string
  method?: "window" | "api"
}

function loadBillingKeys(): StoredBillingKey[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(BILLING_KEYS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveBillingKeys(keys: StoredBillingKey[]) {
  localStorage.setItem(BILLING_KEYS_STORAGE_KEY, JSON.stringify(keys))
}

type BuyerInfo = {
  fullName: string
  email: string
  phoneNumber: string
}

export default function BillingTestPage() {
  const [billingKeys, setBillingKeys] = useState<StoredBillingKey[]>([])
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    fullName: "",
    email: "",
    phoneNumber: "",
  })
  const refreshKeys = useCallback(() => setBillingKeys(loadBillingKeys()), [])
  useEffect(() => {
    refreshKeys()
  }, [refreshKeys])

  const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? ""
  const channelKey = process.env.NEXT_PUBLIC_BILLING_CHANNEL_KEY ?? ""

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          빌링키 결제 연동 테스트
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>구매자 정보</CardTitle>
          <CardDescription>
            결제창 방식 빌링키 발급 시 사용됩니다. (이니시스 V2 등 이메일 필수)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="buyer-fullName">이름</Label>
            <Input
              id="buyer-fullName"
              value={buyerInfo.fullName}
              onChange={(e) =>
                setBuyerInfo((p) => ({ ...p, fullName: e.target.value }))
              }
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-email">이메일 (필수)</Label>
            <Input
              id="buyer-email"
              type="email"
              value={buyerInfo.email}
              onChange={(e) =>
                setBuyerInfo((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="buyer@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-phone">휴대전화번호</Label>
            <Input
              id="buyer-phone"
              type="tel"
              value={buyerInfo.phoneNumber}
              onChange={(e) =>
                setBuyerInfo((p) => ({ ...p, phoneNumber: e.target.value }))
              }
              placeholder="010-0000-0000"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. 빌링키 발급하기</CardTitle>
          <CardDescription>
            결제창 또는 API로 빌링키를 발급하고 localStorage에 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingKeyIssueSection
            storeId={storeId}
            channelKey={channelKey}
            billingKeys={billingKeys}
            onRefresh={refreshKeys}
            buyerInfo={buyerInfo}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 결제 요청하기</CardTitle>
          <CardDescription>
            발급한 빌링키로 즉시 결제를 요청합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentRequestSection billingKeys={billingKeys} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. 예약 결제</CardTitle>
          <CardDescription>
            포트원 결제 예약 API로 예약 결제를 등록합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchedulePaymentSection billingKeys={billingKeys} />
        </CardContent>
      </Card>
    </div>
  )
}

function BillingKeyIssueSection({
  storeId,
  channelKey,
  billingKeys,
  onRefresh,
  buyerInfo,
}: {
  storeId: string
  channelKey: string
  billingKeys: StoredBillingKey[]
  onRefresh: () => void
  buyerInfo: BuyerInfo
}) {
  const [loading, setLoading] = useState<"window" | "api" | null>(null)
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [issueName, setIssueName] = useState("")
  const [issueId, setIssueId] = useState("")
  const [apiForm, setApiForm] = useState({
    customerId: "test-customer-" + randomId().slice(0, 8),
    cardNumber: "",
    expiryYear: "",
    expiryMonth: "",
    birthOrBusinessRegistrationNumber: "",
    passwordTwoDigits: "",
  })

  const issueByWindow = async () => {
    if (!storeId || !channelKey) {
      setMessage({ type: "error", text: "NEXT_PUBLIC_STORE_ID, NEXT_PUBLIC_BILLING_CHANNEL_KEY를 설정해주세요." })
      return
    }
    if (!buyerInfo.email?.trim()) {
      setMessage({ type: "error", text: "이니시스 V2 등 결제창 발급 시 구매자 이메일은 필수입니다." })
      return
    }
    setLoading("window")
    setMessage(null)
    try {
      const res = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod: "CARD",
        ...(issueId.trim() && { issueId: issueId.trim() }),
        ...(issueName.trim() && { issueName: issueName.trim() }),
        customer: {
          fullName: buyerInfo.fullName.trim() || undefined,
          email: buyerInfo.email.trim(),
          phoneNumber: buyerInfo.phoneNumber.trim() || undefined,
        },
      })
      if (res?.code != null) {
        setMessage({ type: "error", text: res.message ?? "빌링키 발급에 실패했습니다." })
        return
      }
      const key = res!.billingKey
      const next: StoredBillingKey = {
        billingKey: key,
        issuedAt: new Date().toISOString(),
        method: "window",
      }
      const keys = loadBillingKeys()
      keys.push(next)
      saveBillingKeys(keys)
      onRefresh()
      setMessage({ type: "ok", text: "빌링키가 발급되어 목록에 저장되었습니다." })
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(null)
    }
  }

  const issueByApi = async () => {
    console.log("[빌링키 API] 클라이언트: API 빌링키 발급 요청 시작")
    setLoading("api")
    setMessage(null)
    const payload = {
      customerId: apiForm.customerId,
      fullName: buyerInfo.fullName.trim(),
      email: buyerInfo.email.trim(),
      phoneNumber: buyerInfo.phoneNumber.trim(),
      cardNumber: apiForm.cardNumber.replace(/\s/g, ""),
      expiryYear: apiForm.expiryYear,
      expiryMonth: apiForm.expiryMonth,
      birthOrBusinessRegistrationNumber: apiForm.birthOrBusinessRegistrationNumber || undefined,
      passwordTwoDigits: apiForm.passwordTwoDigits || undefined,
    }
    console.log("[빌링키 API] 클라이언트: 서버 액션 호출 직전", {
      customerId: payload.customerId,
      fullName: payload.fullName,
      email: payload.email ? "(있음)" : "(없음)",
      phoneNumber: payload.phoneNumber ? "(있음)" : "(없음)",
      cardNumberLength: payload.cardNumber.length,
      expiry: `${payload.expiryYear}/${payload.expiryMonth}`,
    })
    try {
      const res = await issueBillingKeyByApi(payload)
      console.log("[빌링키 API] 클라이언트: 서버 액션 응답 수신", {
        success: res.success,
        billingKeyPrefix: res.success ? res.billingKey.slice(0, 24) + "…" : undefined,
        error: !res.success ? res.error : undefined,
      })
      setLoading(null)
      if (!res.success) {
        setMessage({ type: "error", text: res.error })
        return
      }
      const next: StoredBillingKey = {
        billingKey: res.billingKey,
        issuedAt: new Date().toISOString(),
        customerId: apiForm.customerId,
        method: "api",
      }
      const keys = loadBillingKeys()
      keys.push(next)
      saveBillingKeys(keys)
      setMessage({
        type: "ok",
        text: `빌링키 발급 성공 (API). billingKey: ${res.billingKey.slice(0, 24)}… 저장된 빌링키 목록에 추가되었습니다.`,
      })
      // 다음 틱에서 부모 목록 갱신 (화면에 저장된 빌링키 반영)
      setTimeout(() => onRefresh(), 0)
    } catch (err) {
      console.error("[빌링키 API] 클라이언트: 예외 발생", err)
      setLoading(null)
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const removeKey = (billingKey: string) => {
    const keys = loadBillingKeys().filter((k) => k.billingKey !== billingKey)
    saveBillingKeys(keys)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">빌링키 발급 공통 입력</h3>
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="issue-id">발급 건 ID (issueId)</Label>
            <Input
              id="issue-id"
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              placeholder="예: sub-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-name">발급 건 이름 (issueName)</Label>
            <Input
              id="issue-name"
              value={issueName}
              onChange={(e) => setIssueName(e.target.value)}
              placeholder="예: 월간 이용권 정기결제"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          이니시스 V2 빌링키 발급 시 issueId는 필수, issueName은 결제창에 표시되는 발급 목적 이름입니다.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-1">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">결제창 방식</h3>
          <p className="text-sm text-muted-foreground">
            PG 결제창에서 카드 정보를 입력해 빌링키를 발급합니다.
          </p>
          <Button
            type="button"
            onClick={issueByWindow}
            disabled={!!loading || !storeId || !channelKey}
            aria-busy={loading === "window"}
          >
            결제창으로 빌링키 발급
          </Button>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">API 방식</h3>
          <p className="text-sm text-muted-foreground">
            카드 정보를 입력하면 서버에서 포트원 API로 빌링키를 발급합니다. (테스트 환경에서만 사용)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api-customerId">고객 ID</Label>
              <Input
                id="api-customerId"
                value={apiForm.customerId}
                onChange={(e) => setApiForm((p) => ({ ...p, customerId: e.target.value }))}
                placeholder="customer-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-cardNumber">카드 번호</Label>
              <Input
                id="api-cardNumber"
                value={apiForm.cardNumber}
                onChange={(e) => setApiForm((p) => ({ ...p, cardNumber: e.target.value }))}
                placeholder="숫자 16자리"
                maxLength={19}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-expiryYear">유효기간(년)</Label>
              <Input
                id="api-expiryYear"
                value={apiForm.expiryYear}
                onChange={(e) => setApiForm((p) => ({ ...p, expiryYear: e.target.value }))}
                placeholder="YY"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-expiryMonth">유효기간(월)</Label>
              <Input
                id="api-expiryMonth"
                value={apiForm.expiryMonth}
                onChange={(e) => setApiForm((p) => ({ ...p, expiryMonth: e.target.value }))}
                placeholder="MM"
                maxLength={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="api-birth">생년월일(yyMMdd) 또는 사업자번호</Label>
              <Input
                id="api-birth"
                value={apiForm.birthOrBusinessRegistrationNumber}
                onChange={(e) =>
                  setApiForm((p) => ({ ...p, birthOrBusinessRegistrationNumber: e.target.value }))
                }
                placeholder="선택"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-pw">비밀번호 앞 2자리</Label>
              <Input
                id="api-pw"
                value={apiForm.passwordTwoDigits}
                onChange={(e) => setApiForm((p) => ({ ...p, passwordTwoDigits: e.target.value }))}
                placeholder="선택"
                maxLength={2}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={issueByApi}
            disabled={!!loading}
            aria-busy={loading === "api"}
            variant="secondary"
          >
            API로 빌링키 발급
          </Button>
        </div>
      </div>

      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-sm text-green-600 dark:text-green-400"
              : "text-sm text-destructive"
          }
          role="log"
        >
          {message.text}
        </p>
      )}

      <div className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold">저장된 빌링키 (localStorage)</h3>
        {billingKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">발급한 빌링키가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {billingKeys.map((k) => (
              <li
                key={k.billingKey}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="font-mono text-sm" title={k.billingKey}>
                  {k.billingKey.slice(0, 20)}…
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(k.issuedAt).toLocaleString()} {k.method === "api" ? "(API)" : "(결제창)"}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={() => removeKey(k.billingKey)}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PaymentRequestSection({ billingKeys }: { billingKeys: StoredBillingKey[] }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: "ok" | "error"; text: string; status?: string } | null>(
    null
  )
  const [form, setForm] = useState({
    billingKey: "",
    orderName: "빌링키 결제 테스트",
    amount: "1000",
    currency: "KRW",
    customerId: "",
    fullName: "",
    email: "",
    phoneNumber: "",
  })

  useEffect(() => {
    if (billingKeys.length > 0 && !form.billingKey) {
      setForm((p) => ({ ...p, billingKey: billingKeys[0].billingKey }))
    }
  }, [billingKeys, form.billingKey])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setLoading(true)
    const paymentId = randomId()
    const customer: CustomerForm | undefined =
      form.fullName || form.email || form.phoneNumber || form.customerId
        ? {
            id: form.customerId || undefined,
            fullName: form.fullName || undefined,
            email: form.email || undefined,
            phoneNumber: form.phoneNumber || undefined,
          }
        : undefined
    const res = await payWithBillingKeyAction({
      paymentId,
      billingKey: form.billingKey,
      orderName: form.orderName,
      amount: Number(form.amount) || 0,
      currency: form.currency,
      customer,
    })
    setLoading(false)
    if (res.success) {
      const statusRes = await getPaymentStatusAction(paymentId)
      const status = statusRes.success ? statusRes.status : "-"
      setResult({ type: "ok", text: "결제 요청이 완료되었습니다.", status: String(status) })
    } else {
      setResult({ type: "error", text: res.error })
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label>빌링키 선택</Label>
          {billingKeys.length === 0 ? (
            <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              빌링키를 먼저 발급해주세요
            </div>
          ) : (
            <Select
              value={form.billingKey}
              onValueChange={(v) => setForm((p) => ({ ...p, billingKey: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {billingKeys.map((k) => (
                  <SelectItem key={k.billingKey} value={k.billingKey}>
                    {k.billingKey.slice(0, 24)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay-orderName">주문명</Label>
          <Input
            id="pay-orderName"
            value={form.orderName}
            onChange={(e) => setForm((p) => ({ ...p, orderName: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">결제 금액</Label>
            <Input
              id="pay-amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>통화</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
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
        </div>
        <div className="rounded-lg bg-muted/50 p-3 space-y-3">
          <span className="text-sm text-muted-foreground">고객 정보 (선택)</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-customerId">고객 ID</Label>
              <Input
                id="pay-customerId"
                value={form.customerId}
                onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                placeholder="id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-fullName">이름</Label>
              <Input
                id="pay-fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="fullName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-email">이메일</Label>
              <Input
                id="pay-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-phone">전화번호</Label>
              <Input
                id="pay-phone"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
        </div>
        <Button type="submit" disabled={loading || billingKeys.length === 0} aria-busy={loading}>
          결제 요청
        </Button>
      </form>
      {result && (
        <p
          className={
            result.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"
          }
        >
          {result.text}
          {result.status != null && ` (상태: ${result.status})`}
        </p>
      )}
    </div>
  )
}

function SchedulePaymentSection({ billingKeys }: { billingKeys: StoredBillingKey[] }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const defaultTime = () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 10)
    return d.toISOString().slice(0, 16)
  }
  const [form, setForm] = useState({
    billingKey: "",
    orderName: "예약 결제 테스트",
    amount: "1000",
    currency: "KRW",
    timeToPay: defaultTime(),
    customerId: "",
    fullName: "",
    email: "",
    phoneNumber: "",
  })

  useEffect(() => {
    if (billingKeys.length > 0 && !form.billingKey) {
      setForm((p) => ({ ...p, billingKey: billingKeys[0].billingKey }))
    }
  }, [billingKeys, form.billingKey])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setLoading(true)
    const paymentId = randomId()
    const customer: CustomerForm | undefined =
      form.fullName || form.email || form.phoneNumber || form.customerId
        ? {
            id: form.customerId || undefined,
            fullName: form.fullName || undefined,
            email: form.email || undefined,
            phoneNumber: form.phoneNumber || undefined,
          }
        : undefined
    const timeToPay = new Date(form.timeToPay).toISOString()
    const res = await schedulePaymentAction({
      paymentId,
      billingKey: form.billingKey,
      orderName: form.orderName,
      amount: Number(form.amount) || 0,
      currency: form.currency,
      timeToPay,
      customer,
    })
    setLoading(false)
    if (res.success) {
      setResult({ type: "ok", text: `예약이 완료되었습니다. (${form.timeToPay} 결제 시도)` })
    } else {
      setResult({ type: "error", text: res.error })
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label>빌링키 선택</Label>
          {billingKeys.length === 0 ? (
            <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              빌링키를 먼저 발급해주세요
            </div>
          ) : (
            <Select
              value={form.billingKey}
              onValueChange={(v) => setForm((p) => ({ ...p, billingKey: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {billingKeys.map((k) => (
                  <SelectItem key={k.billingKey} value={k.billingKey}>
                    {k.billingKey.slice(0, 24)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sch-orderName">주문명</Label>
          <Input
            id="sch-orderName"
            value={form.orderName}
            onChange={(e) => setForm((p) => ({ ...p, orderName: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sch-amount">결제 금액</Label>
            <Input
              id="sch-amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>통화</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="sch-timeToPay">결제 예정 시각</Label>
          <Input
            id="sch-timeToPay"
            type="datetime-local"
            value={form.timeToPay}
            onChange={(e) => setForm((p) => ({ ...p, timeToPay: e.target.value }))}
            required
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-3 space-y-3">
          <span className="text-sm text-muted-foreground">고객 정보 (선택)</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sch-customerId">고객 ID</Label>
              <Input
                id="sch-customerId"
                value={form.customerId}
                onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                placeholder="id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-fullName">이름</Label>
              <Input
                id="sch-fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="fullName"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-email">이메일</Label>
              <Input
                id="sch-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-phone">전화번호</Label>
              <Input
                id="sch-phone"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
        </div>
        <Button type="submit" disabled={loading || billingKeys.length === 0} aria-busy={loading}>
          예약 결제 등록
        </Button>
      </form>
      {result && (
        <p
          className={
            result.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"
          }
        >
          {result.text}
        </p>
      )}
    </div>
  )
}
