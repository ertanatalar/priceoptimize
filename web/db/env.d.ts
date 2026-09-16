declare namespace NodeJS {
  interface ProcessEnv {
    MYSQL_HTTP_URL?: string;
    MYSQL_HTTP_TOKEN?: string;
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?: string;
    PADDLE_API_KEY?: string;
    PADDLE_WEBHOOK_SECRET?: string;
    PADDLE_PRICE_ID_STARTER?: string;
    PADDLE_ENVIRONMENT?: 'sandbox' | 'production';
  }
}
