import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { EnrollmentComponent } from '../../enrollment/enrollment/enrollment.component';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule,EnrollmentComponent, FormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  isMenuOpen = false;
  showEnrollmentModal = false;
  footerModalType: string | null = null;
  footerModalTitle = '';
  contact = {
  name: '',
  email: '',
  message: ''
};

sendingMessage = false;
contactSuccess = false;
contactError = false;

  faqs = [
    {
      icon: '🔐',
      question: 'How to reset my pin?',
      answer: 'Go to the login screen, tap "Forgot PIN", and follow the OTP verification process.',
      open: false
    },
    {
      icon: '🏢',
      question: 'Can I update my flat or block info?',
      answer: 'Yes, contact your apartment admin or use the Profile > Edit section if enabled.',
      open: false
    },
    {
      icon: '🐞',
      question: 'How do I report a bug?',
      answer: 'Use the "Contact Support" form below or email us with details and screenshots.',
      open: false
    }
  ];
  
  constructor(private router: Router,private elementRef: ElementRef,private cdr: ChangeDetectorRef, private http: HttpClient) {}

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }
  reloadPage(event: MouseEvent) {
    event.preventDefault();
    window.location.href = '/'; 
  }
  goToLogin() {
    this.router.navigate(['/login']);
  }
  closeMenu() {
    if (this.isMenuOpen) {
      this.isMenuOpen = false;
      document.body.style.overflow = '';
    }
  }
  closeModal() {
    this.showEnrollmentModal = false;
  }

 closeEnrollmentPopup() {
  console.log('[Parent] closeEnrollmentPopup() called');
  this.showEnrollmentModal = false;
  this.cdr.detectChanges(); 
}
  

  @HostListener('document:click', ['$event'])
onClickOutside(event: MouseEvent) {
  const clickedInside = this.elementRef.nativeElement.contains(event.target);
  if (!clickedInside) {
    this.isMenuOpen = false;
  }
}
// get footerModalTitle() {
//   switch (this.footerModalType) {
//     case 'privacy': return 'Privacy Policy';
//     case 'terms': return 'Terms of Use';
//     default: return '';
//   }
// }

openFooterModal(type: 'privacy' | 'terms') {
  this.footerModalType = type;
  this.footerModalTitle = type === 'privacy' ? 'Privacy Policy' : 'Terms of Use';
}

closeFooterModal() {
  this.footerModalType = null;
}
sendContactMessage(): void {

  this.sendingMessage = true;
  this.contactSuccess = false;
  this.contactError = false;

  const payload = {
    name: this.contact.name,
    email: this.contact.email,
    message: this.contact.message
  };

  this.http.post(
    'https://sendcontactemail-n5xsrpjk7a-uc.a.run.app',
    payload
  ).subscribe({

    next: () => {

      this.sendingMessage = false;
      this.contactSuccess = true;

      this.contact = {
        name: '',
        email: '',
        message: ''
      };
    },

    error: (error) => {

      console.error('Contact email error:', error);

      this.sendingMessage = false;
      this.contactError = true;
    }

  });
}
scrollToContact() {
  const contactEl = document.getElementById('contact');
  contactEl?.scrollIntoView({ behavior: 'smooth' });
}
}
