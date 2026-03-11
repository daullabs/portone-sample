"use client"

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
import { randomId } from "@/lib/random"
import * as PortOne from "@portone/browser-sdk/v2"
import type { VerifiedIdentityVerification } from "@portone/server-sdk/identityVerification"
import { useCallback, useEffect, useState } from "react"
import { getIdentityVerificationAction } from "./actions"

type Message = { type: "ok" | "error"; text: string } | null

export default function IdentityVerificationTestPage() {
  const [message, setMessage] = useState<Message>(null)
  const [loading, setLoading] = useState(false)
  const [lastVerificationId, setLastVerificationId] = useState<string | null>(
    null
  )
  const [verifiedResult, setVerifiedResult] =
    useState<VerifiedIdentityVerification | null>(null)
  const [fetchingResult, setFetchingResult] = useState(false)

  const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? ""
  const channelKey = process.env.NEXT_PUBLIC_IDENTITY_CHANNEL_KEY ?? ""

  // KG이니시스 통합인증 옵션 (선택)
  const [bypassFlgFixedUser, setBypassFlgFixedUser] = useState<"Y" | "N">("N")
  const [bypassDirectAgency, setBypassDirectAgency] = useState<
    "" | "PASS" | "PAYCO" | "TOSS" | "KAKAO" | "NAVER" | "SMS"
  >("")
  const [bypassLogoUrl, setBypassLogoUrl] = useState("")
  // flgFixedUser Y일 때 필수: 이름, 연락처, 출생년도, 출생월, 출생일
  const [fixedUserFullName, setFixedUserFullName] = useState("")
  const [fixedUserPhoneNumber, setFixedUserPhoneNumber] = useState("")
  const [fixedUserBirthYear, setFixedUserBirthYear] = useState("")
  const [fixedUserBirthMonth, setFixedUserBirthMonth] = useState("")
  const [fixedUserBirthDay, setFixedUserBirthDay] = useState("")

  const startVerification = useCallback(async () => {
    if (!storeId || !channelKey) {
      setMessage({
        type: "error",
        text: "NEXT_PUBLIC_STORE_ID, NEXT_PUBLIC_IDENTITY_CHANNEL_KEY를 설정해주세요. (본인인증 채널을 콘솔에서 등록한 뒤 채널 키를 입력하세요.)",
      })
      return
    }
    if (bypassFlgFixedUser === "Y") {
      const name = fixedUserFullName.trim()
      const phone = fixedUserPhoneNumber.trim().replace(/\D/g, "")
      const y = fixedUserBirthYear.trim()
      const m = fixedUserBirthMonth.trim()
      const d = fixedUserBirthDay.trim()
      if (!name || !phone || !y || !m || !d) {
        setMessage({
          type: "error",
          text: "flgFixedUser가 Y일 때 이름, 연락처, 출생년도, 출생월, 출생일을 모두 입력해주세요.",
        })
        return
      }
      if (phone.length < 10) {
        setMessage({
          type: "error",
          text: "연락처를 올바르게 입력해주세요 (숫자 10~11자).",
        })
        return
      }
    }
    setMessage(null)
    setVerifiedResult(null)
    setLoading(true)
    const identityVerificationId = `identity-${randomId()}`
    setLastVerificationId(identityVerificationId)

    try {
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : ""
      const redirectUrl = `${baseUrl}/identity?redirect=1`

      const res = await PortOne.requestIdentityVerification({
        storeId,
        channelKey,
        identityVerificationId,
        redirectUrl,
        ...(bypassFlgFixedUser === "Y" &&
          fixedUserFullName.trim() &&
          fixedUserPhoneNumber.trim() &&
          fixedUserBirthYear.trim() &&
          fixedUserBirthMonth.trim() &&
          fixedUserBirthDay.trim() && {
            customer: {
              fullName: fixedUserFullName.trim(),
              phoneNumber: fixedUserPhoneNumber.trim().replace(/\D/g, ""),
              birthYear: fixedUserBirthYear.trim(),
              birthMonth: fixedUserBirthMonth.trim().padStart(2, "0"),
              birthDay: fixedUserBirthDay.trim().padStart(2, "0"),
            },
          }),
        bypass:
          channelKey && (bypassFlgFixedUser || bypassDirectAgency || bypassLogoUrl)
            ? {
                inicisUnified: {
                  flgFixedUser: bypassFlgFixedUser,
                  ...(bypassDirectAgency && {
                    directAgency: bypassDirectAgency as
                      | "PAYCO"
                      | "PASS"
                      | "TOSS"
                      | "KFTC"
                      | "KAKAO"
                      | "NAVER"
                      | "SAMSUNG"
                      | "SHINHAN"
                      | "KB"
                      | "HANA"
                      | "WOORI"
                      | "NH"
                      | "KAKAOBANK"
                      | "SMS",
                  }),
                  ...(bypassLogoUrl.trim() && { logoUrl: bypassLogoUrl.trim() }),
                },
              }
            : undefined,
      })

      if (res?.code != null) {
        setMessage({
          type: "error",
          text: res.message ?? "본인인증 요청에 실패했습니다.",
        })
        return
      }
      if (res?.identityVerificationId) {
        setLastVerificationId(res.identityVerificationId)
        setMessage({
          type: "ok",
          text: "본인인증이 완료되었습니다. 아래에서 인증 결과를 조회할 수 있습니다.",
        })
      }
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
    bypassFlgFixedUser,
    bypassDirectAgency,
    bypassLogoUrl,
    fixedUserFullName,
    fixedUserPhoneNumber,
    fixedUserBirthYear,
    fixedUserBirthMonth,
    fixedUserBirthDay,
  ])

  const fetchResult = useCallback(async () => {
    if (!lastVerificationId) return
    setMessage(null)
    setFetchingResult(true)
    try {
      const result = await getIdentityVerificationAction(lastVerificationId)
      if (result.success) {
        setVerifiedResult(result.data)
        setMessage({ type: "ok", text: "인증 결과를 조회했습니다." })
      } else {
        setMessage({ type: "error", text: result.error })
      }
    } finally {
      setFetchingResult(false)
    }
  }, [lastVerificationId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const id = params.get("identityVerificationId")
    if (id) {
      setLastVerificationId(id)
      setMessage({
        type: "ok",
        text: "본인인증 후 돌아왔습니다. 아래 '인증 결과 조회' 버튼으로 서버에서 결과를 확인하세요.",
      })
      window.history.replaceState({}, "", "/identity")
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          본인인증 테스트
        </h1>
        <p className="text-sm text-muted-foreground">
          포트원 본인인증(휴대폰 본인인증, KG이니시스 통합인증 등)을 테스트합니다.{" "}
          <a
            href="https://developers.portone.io/opi/ko/integration/pg/v2/inicis-unified-identity-verification?v=v2"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            KG이니시스 통합인증 문서
          </a>
          ,{" "}
          <a
            href="https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            본인인증 연동하기
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
          <CardTitle>1. 본인인증 요청</CardTitle>
          <CardDescription>
            Store ID와 본인인증용 채널 키가 필요합니다. 관리자 콘솔에서 채널
            속성을 &quot;본인인증&quot;으로 설정한 채널의 채널 키를 사용하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startVerification}
              disabled={loading || !storeId || !channelKey}
            >
              {loading ? "인증창 열림…" : "본인인증 시작"}
            </Button>
          </div>
          {lastVerificationId && (
            <p className="text-xs text-muted-foreground">
              마지막 인증 ID: <code className="rounded bg-muted px-1">{lastVerificationId}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KG이니시스 통합인증 옵션 (선택)</CardTitle>
          <CardDescription>
            KG이니시스 통합인증 채널 사용 시 bypass 파라미터입니다.{" "}
            <code>flgFixedUser</code>는 필수입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>flgFixedUser</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={bypassFlgFixedUser}
              onChange={(e) =>
                setBypassFlgFixedUser(e.target.value as "Y" | "N")
              }
            >
              <option value="N">N (기본)</option>
              <option value="Y">Y (고객 정보 자동 입력 시 필수 입력값 있음)</option>
            </select>
          </div>
          {bypassFlgFixedUser === "Y" && (
            <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 sm:col-span-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                flgFixedUser Y 필수 입력값
              </p>
              <p className="text-xs text-muted-foreground">
                이름, 연락처, 출생년도, 출생월, 출생일을 입력하면 인증창에 자동으로 표시됩니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fixed-user-name">이름</Label>
                  <Input
                    id="fixed-user-name"
                    value={fixedUserFullName}
                    onChange={(e) => setFixedUserFullName(e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixed-user-phone">연락처</Label>
                  <Input
                    id="fixed-user-phone"
                    type="tel"
                    value={fixedUserPhoneNumber}
                    onChange={(e) => setFixedUserPhoneNumber(e.target.value)}
                    placeholder="01012345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixed-user-birth-year">출생년도</Label>
                  <Input
                    id="fixed-user-birth-year"
                    value={fixedUserBirthYear}
                    onChange={(e) => setFixedUserBirthYear(e.target.value)}
                    placeholder="1990"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixed-user-birth-month">출생월</Label>
                  <Input
                    id="fixed-user-birth-month"
                    value={fixedUserBirthMonth}
                    onChange={(e) => setFixedUserBirthMonth(e.target.value)}
                    placeholder="1 또는 01"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fixed-user-birth-day">출생일</Label>
                  <Input
                    id="fixed-user-birth-day"
                    value={fixedUserBirthDay}
                    onChange={(e) => setFixedUserBirthDay(e.target.value)}
                    placeholder="15"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>directAgency (인증 업체 고정)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={bypassDirectAgency}
              onChange={(e) =>
                setBypassDirectAgency(
                  e.target.value as "" | "PASS" | "PAYCO" | "TOSS" | "KAKAO" | "NAVER" | "SMS"
                )
              }
            >
              <option value="">선택 안 함</option>
              <option value="PASS">PASS</option>
              <option value="PAYCO">PAYCO</option>
              <option value="TOSS">TOSS</option>
              <option value="KAKAO">KAKAO</option>
              <option value="NAVER">NAVER</option>
              <option value="SMS">SMS (계약 필요)</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>logoUrl (인증창 로고 URL, HTTPS 권장)</Label>
            <Input
              type="url"
              placeholder="https://example.com/logo.png"
              value={bypassLogoUrl}
              onChange={(e) => setBypassLogoUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 인증 결과 조회</CardTitle>
          <CardDescription>
            본인인증 완료 후 서버에서 인증 결과를 조회합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="secondary"
            onClick={fetchResult}
            disabled={!lastVerificationId || fetchingResult}
          >
            {fetchingResult ? "조회 중…" : "인증 결과 조회"}
          </Button>
          {verifiedResult && (
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <p className="mb-2 font-medium">인증된 고객 정보</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>이름: {verifiedResult.verifiedCustomer.name}</li>
                <li>생년월일: {verifiedResult.verifiedCustomer.birthDate}</li>
                {verifiedResult.verifiedCustomer.phoneNumber && (
                  <li>휴대폰: {verifiedResult.verifiedCustomer.phoneNumber}</li>
                )}
                {verifiedResult.verifiedCustomer.gender != null && (
                  <li>성별: {verifiedResult.verifiedCustomer.gender}</li>
                )}
                {verifiedResult.verifiedCustomer.isForeigner != null && (
                  <li>외국인 여부: {verifiedResult.verifiedCustomer.isForeigner ? "Y" : "N"}</li>
                )}
                {verifiedResult.verifiedCustomer.ci && (
                  <li>CI: {verifiedResult.verifiedCustomer.ci}</li>
                )}
                {verifiedResult.verifiedCustomer.di && (
                  <li>DI: {verifiedResult.verifiedCustomer.di}</li>
                )}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                인증 완료 시각: {verifiedResult.verifiedAt}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
