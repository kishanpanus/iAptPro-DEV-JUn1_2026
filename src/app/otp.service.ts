import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom, Observable } from 'rxjs';
import { FirestoreService } from './services/services/firestore.service';
import { environment } from './environment/environment';

@Injectable({
  providedIn: 'root'
})
export class OtpService {

   private sendUrl   = 'https://sendotp-n5xsrpjk7a-uc.a.run.app';
  private verifyUrl = 'https://verifyotp-n5xsrpjk7a-uc.a.run.app';
  
    //private otpTemplate = 'OTP1';
    private cachedApiKey: string | null = null;
    private templateName = 'LoginOTPTemplate';
      private senderId = 'APTMMM'; 
  
    constructor(private http: HttpClient, private firestoreService: FirestoreService) {}
  
    // 🔹 Get API Key (cached to avoid multiple Firestore reads)
    private async getApiKey(): Promise<string> {
      if (this.cachedApiKey) {
        return this.cachedApiKey;
      }
      this.cachedApiKey = await this.firestoreService.getOtpApiKey();
      if (!this.cachedApiKey) {
        throw new Error('Missing 2Factor API Key');
      }
      return this.cachedApiKey;
    }

    async sendOtp(phone: string) {
    return await lastValueFrom(this.http.post(this.sendUrl, { phone }));
  }

  // Call backend to verify OTP
  async verifyOtp(sessionId: string, otp: string) {
    return await lastValueFrom(this.http.post(this.verifyUrl, { sessionId, otp }));
  }

  //   async sendOtp(phoneNumber: string): Promise<any> {
  //   const apiKey = await this.getApiKey();
  //   const to = this.ensureE164(phoneNumber); // e.g., +91xxxxxxxxxx

  //   // Endpoint shape:
  //   // https://2factor.in/API/V1/{API_KEY}/SMS/{TO}/AUTOGEN/OTP/{TEMPLATE_NAME}/From/{SENDERID}
  //   const url =
  //     `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}` +
  //     `/SMS/${encodeURIComponent(to)}` +
  //     `/AUTOGEN/OTP/${encodeURIComponent(this.templateName)}` +
  //     `/From/${encodeURIComponent(this.senderId)}`;

  //   try {
  //     const res = await lastValueFrom(this.http.get(url));
  //     return res; // { Status: 'Success', Details: '<sessionId>' }
  //   } catch (err) {
  //     // If you see a CORS error in the browser, call your own backend instead.
  //     throw err;
  //   }
  // }

  // // 🔹 Verify OTP using sessionId from sendOtp().Details
  // async verifyOtp(sessionId: string, otp: string): Promise<any> {
  //   const apiKey = await this.getApiKey();
  //   const url =
  //     `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}` +
  //     `/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;
  //   return lastValueFrom(this.http.get(url));
  // }

  // --- helpers ---
  private ensureE164(phone: string): string {
    const p = (phone || '').replace(/\D/g, '');
    // add India code if not present; adjust if you support multiple countries
    return p.startsWith('91') && p.length === 12 ? `+${p}` : `+91${p}`;
  }
}
    // 🔹 Send OTP
    // async sendOtp(phoneNumber: string): Promise<any> {
    //   try {
    //     const apiKey = await this.getApiKey();
    //     const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phoneNumber}/AUTOGEN/${this.otpTemplate}`;
    //     console.log('Sending OTP Request:', url);
  
    //     // Convert Observable → Promise
    //     const response = await lastValueFrom(this.http.get(url));
    //     console.log('2Factor OTP Response:', response);
    //     return response;
    //   } catch (error) {
    //     console.error('Error in sendOtp:', error);
    //     throw error;
    //   }
    // }
  
    // 🔹 Verify OTP
  //   async verifyOtp(sessionId: string, otp: string): Promise<any> {
  //     try {
  //       const apiKey = await this.getApiKey();
  //       const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;
  //       console.log('Verifying OTP Request:', url);
  
  //       const response = await lastValueFrom(this.http.get(url));
  //       console.log('2Factor Verify Response:', response);
  //       return response;
  //     } catch (error) {
  //       console.error('Error in verifyOtp:', error);
  //       throw error;
  //     }
  //   }
  // }
