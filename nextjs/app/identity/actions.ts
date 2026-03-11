"use server"

import {
  IdentityVerificationClient,
  GetIdentityVerificationError,
} from "@portone/server-sdk/identityVerification"
import type { VerifiedIdentityVerification } from "@portone/server-sdk/identityVerification"

const portone = IdentityVerificationClient({
  secret: process.env.V2_API_SECRET!,
})

export type GetIdentityVerificationResult =
  | { success: true; data: VerifiedIdentityVerification }
  | { success: false; error: string }

export async function getIdentityVerificationAction(
  identityVerificationId: string
): Promise<GetIdentityVerificationResult> {
  if (!process.env.V2_API_SECRET) {
    return { success: false, error: "V2_API_SECRET이 설정되지 않았습니다." }
  }
  try {
    const verification = await portone.getIdentityVerification({
      identityVerificationId: identityVerificationId.trim(),
    })
    if (verification.status !== "VERIFIED") {
      return {
        success: false,
        error: `인증이 완료되지 않았습니다. (상태: ${String(verification.status)})`,
      }
    }
    return { success: true, data: verification }
  } catch (e) {
    if (e instanceof GetIdentityVerificationError) {
      return {
        success: false,
        error: e.message ?? "본인인증 조회에 실패했습니다.",
      }
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
