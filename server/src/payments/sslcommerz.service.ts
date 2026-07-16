import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SslCommerzIpn = {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  risk_level?: string;
  bank_tran_id?: string;
  card_type?: string;
};
export type SslCommerzValidation = SslCommerzIpn & {
  APIConnect?: string;
  risk_title?: string;
  validated_on?: string;
};

@Injectable()
export class SslCommerzService {
  constructor(private readonly config: ConfigService) {}
  get configured() {
    return Boolean(
      this.config.get("SSLCOMMERZ_STORE_ID") &&
      this.config.get("SSLCOMMERZ_STORE_PASSWORD") &&
      this.config.get("PUBLIC_API_URL"),
    );
  }
  private get baseUrl() {
    return this.config.get("SSLCOMMERZ_LIVE") === "true"
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com";
  }
  private credentials() {
    const storeId = this.config.get<string>("SSLCOMMERZ_STORE_ID"),
      password = this.config.get<string>("SSLCOMMERZ_STORE_PASSWORD");
    if (!storeId || !password)
      throw new ServiceUnavailableException("SSLCommerz is not configured");
    return { storeId, password };
  }
  async createSession(input: {
    transactionId: string;
    amount: number;
    customerName: string;
    phone: string;
    email?: string | null;
  }) {
    const { storeId, password } = this.credentials(),
      publicApi = this.config.get<string>("PUBLIC_API_URL");
    if (!publicApi)
      throw new ServiceUnavailableException(
        "Public payment callback URL is not configured",
      );
    const fields = new URLSearchParams({
      store_id: storeId,
      store_passwd: password,
      total_amount: input.amount.toFixed(2),
      currency: "BDT",
      tran_id: input.transactionId,
      success_url: `${publicApi}/payments/sslcommerz/return/success`,
      fail_url: `${publicApi}/payments/sslcommerz/return/fail`,
      cancel_url: `${publicApi}/payments/sslcommerz/return/cancel`,
      ipn_url: `${publicApi}/payments/sslcommerz/ipn`,
      shipping_method: "NO",
      product_name: `${input.amount} SocialConnect points`,
      product_category: "digital_service",
      product_profile: "non-physical-goods",
      cus_name: input.customerName.slice(0, 50),
      cus_email: input.email || "payments@socialconnect.invalid",
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: input.phone,
    });
    const response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fields,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new BadGatewayException("SSLCommerz checkout is unavailable");
    const result = (await response.json()) as {
      status?: string;
      sessionkey?: string;
      GatewayPageURL?: string;
      failedreason?: string;
    };
    if (
      result.status !== "SUCCESS" ||
      !result.sessionkey ||
      !result.GatewayPageURL
    )
      throw new BadGatewayException(
        result.failedreason || "SSLCommerz rejected checkout creation",
      );
    return {
      sessionKey: result.sessionkey,
      checkoutUrl: result.GatewayPageURL,
    };
  }
  async validate(valId: string) {
    if (!valId || valId.length > 100)
      throw new BadRequestException("Missing SSLCommerz validation ID");
    const { storeId, password } = this.credentials(),
      query = new URLSearchParams({
        val_id: valId,
        store_id: storeId,
        store_passwd: password,
        format: "json",
        v: "1",
      });
    const response = await fetch(
      `${this.baseUrl}/validator/api/validationserverAPI.php?${query}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok)
      throw new BadGatewayException("SSLCommerz validation is unavailable");
    const result = (await response.json()) as SslCommerzValidation;
    if (
      !["VALID", "VALIDATED"].includes(result.status ?? "") ||
      result.APIConnect !== "DONE"
    )
      throw new BadRequestException("SSLCommerz transaction validation failed");
    return result;
  }
  async query(transactionId: string) {
    if (!transactionId || transactionId.length > 100) throw new BadRequestException('Invalid SSLCommerz transaction ID');
    const { storeId, password } = this.credentials(), query = new URLSearchParams({ tran_id:transactionId,store_id:storeId,store_passwd:password,format:'json' });
    const response = await fetch(`${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${query}`, { signal:AbortSignal.timeout(15_000) });
    if (!response.ok) throw new BadGatewayException('SSLCommerz transaction query is unavailable');
    return response.json() as Promise<SslCommerzValidation>;
  }
}
