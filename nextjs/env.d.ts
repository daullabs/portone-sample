namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_STORE_ID: string
    /** 1. 일반 결제 테스트(1회성 결제) */
    NEXT_PUBLIC_PAYMENT_CHANNEL_KEY: string
    /** 2. 빌링키 결제 테스트(정기 결제) */
    NEXT_PUBLIC_BILLING_CHANNEL_KEY: string
    V2_API_SECRET: string
  }
}
