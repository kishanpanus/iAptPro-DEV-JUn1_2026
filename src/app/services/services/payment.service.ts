// payment.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

declare var Cashfree: any;

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private cashfreeOrderUrl =
    'https://createcashfreeorder-n5xsrpjk7a-uc.a.run.app';

  constructor(private http: HttpClient) {}

  initiatePayment(
    flatOwnerId: string,
    year: string,
    month: string,
    amountToPay: number
  ): void {

    const orderId =
      'APT3M-MAINT-' +
      flatOwnerId +
      '-' +
      year +
      '-' +
      month +
      '-' +
      Date.now();

    const orderPayload = {
      orderId: orderId,
      orderAmount: amountToPay,

      // Cashfree requires customer details.
      // Replace these when owner details are available.
      customerName: 'APT3M Owner',
      customerEmail: 'support@apt3m.com',
      customerPhone: '9999999999'
    };

    console.log('Creating Cashfree order:', orderPayload);

    this.http.post(
      this.cashfreeOrderUrl,
      orderPayload
    ).subscribe({

      next: (res: any) => {

        console.log('Cashfree order response:', res);

        if (res.payment_session_id) {

          const cashfree = Cashfree({
            mode: 'sandbox'
          });

          const returnUrl =
            window.location.origin +
            '/payment-status' +
            '?order_id=' +
            encodeURIComponent(orderId) +
            '&flatOwnerId=' +
            encodeURIComponent(flatOwnerId) +
            '&year=' +
            encodeURIComponent(year) +
            '&month=' +
            encodeURIComponent(month) +
            '&amount=' +
            encodeURIComponent(amountToPay.toString()) +
            '&paymentType=MAINTENANCE';

          cashfree.checkout({
            paymentSessionId: res.payment_session_id,
            returnUrl: returnUrl
          });

        } else {

          console.error(
            'payment_session_id missing:',
            res
          );

          alert('Error generating payment session.');
        }
      },

      error: (error) => {

        console.error(
          'Failed to initiate payment:',
          error
        );

        alert(
          'Failed to initiate payment. Please try again.'
        );
      }
    });
  }
}