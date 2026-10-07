import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './dashboard/dashboard/dashboard.component';
import { AdminComponent } from './admin/admin/admin.component';
import { ChargesComponent } from './charges/charges/charges.component';
import { SuperadminComponent } from './superadmin/superadmin/superadmin.component';
import { AuthGuard } from './auth.guard';
import { EnrollmentComponent } from './enrollment/enrollment/enrollment.component';
import { MarketplaceComponent } from './marketplace/marketplace/marketplace.component';
import { LandingComponent } from './landing/landing/landing.component';

import { TermsOfUseComponent } from './pages/terms-of-use/terms-of-use.component';
import { ContactUsComponent } from './pages/contact-us/contact-us.component';
import { SecurityComponent } from './security/security.component';
import { SetPinComponent } from './set-pin/set-pin.component';
import { EnterPinComponent } from './enter-pin/enter-pin.component';
import { TermsComponent } from './legal/terms/terms.component';
import { RefundPolicyComponent } from './legal/refund-policy/refund-policy.component';
import { ContactComponent } from './contact/contact.component';
import { PrivacyPolicyComponent } from './legal/privacy-policy/privacy-policy.component';
import { ShippingPolicyComponent } from './shipping-policy/shipping-policy.component';
import { PaymentStatusComponent } from './payment-status/payment-status.component';
import { EnrollmentSuccessComponent } from './enrollment-success/enrollment-success.component';
import { UpgradeModelComponent } from './upgrade-model/upgrade-model/upgrade-model.component';
import { PaySubscriptionComponent } from './pay-subscription/pay-subscription.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },  // main landing page
  { path: 'login', loadComponent: () => import('../app/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'superadmin', component: SuperadminComponent, canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'charges', component: ChargesComponent },
  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard] },
  { path: 'enrollment', component: EnrollmentComponent },
  { path: 'terms-of-use', component: TermsOfUseComponent },
  { path: 'contact-us', component: ContactUsComponent },
  { path: 'set-pin', component: SetPinComponent },
  { path: 'enter-pin', component: EnterPinComponent },
  { path: 'terms', component: TermsComponent },
{ path: 'refund-policy', component: RefundPolicyComponent },
{ path: 'privacy-policy', component: PrivacyPolicyComponent },
{ path: 'contact', component: ContactComponent },
{ path: 'shipping-policy', component: ShippingPolicyComponent },
{ path: 'payment-status', component: PaymentStatusComponent },
{ path: 'enrollment-success', component: EnrollmentSuccessComponent },
{path:'pay-subscription', component:PaySubscriptionComponent},
{
  path: 'upgrade',
  component: UpgradeModelComponent
},
  {
    path: 'security',
    component: SecurityComponent
  },
  {
    path: 'superadmin/view-admin/:apartmentId/:adminId',
    component: AdminComponent
  },
  {
    path: 'marketplace',
    component: MarketplaceComponent,
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '' }  // wildcard fallback
];

  

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
