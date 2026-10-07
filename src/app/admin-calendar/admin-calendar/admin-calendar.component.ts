import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { collectionData } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { addDoc, collection, deleteDoc, doc, Firestore, updateDoc } from 'firebase/firestore';
import { FirestoreService } from '../../services/services/firestore.service';
import { AuthService } from '../../auth.service';
import { Auth } from 'firebase/auth';
import { ActivatedRoute } from '@angular/router';
import { ModalService } from '../../services/services/model.service';

@Component({
  selector: 'app-admin-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-calendar.component.html',
  styleUrls: ['./admin-calendar.component.css']

})
export class AdminCalendarComponent implements OnInit {
  @Input() apartmentId!: string;
  @Input() role: 'admin' | 'owner' = 'admin';
  @Input() flatOwnerBlock: string = '';
  @Input() flatOwnerFlat: string = '';
  @Input() flatOwnerPhone: string = '';
  @Input() blockModeEnabled: boolean = false;

  selectedDate: string = '';
  selectedTime: string = '';
  newEventTitle: string = '';
  newEventType: 'clubhouse' | 'event' = 'clubhouse';
  editingEventId: string | null = null;

  events: any[] = [];


  constructor(private firestoreService: FirestoreService, private authService: AuthService, private route: ActivatedRoute,private modalService: ModalService) {}


  ngOnInit(): void {
    if (!this.apartmentId?.trim()) {
      console.warn('Skipping calendar load — apartmentId missing.');
      return;
    }
    this.loadEvents();
  }

  get visibleEvents() {
    return this.role === 'admin'
      ? this.events
      : this.events.filter(e => e.status === 'approved' || e.type === 'event');
  }

  async addOrUpdateEvent() {
    if (!this.selectedDate || !this.newEventTitle || !this.apartmentId) return;

    const datetime = this.selectedTime
      ? `${this.selectedDate}T${this.selectedTime}`
      : this.selectedDate;

    const event: any = {
      title: this.newEventTitle,
      type: this.newEventType,
      date: datetime,
      createdAt: new Date().toISOString()
    };

    if (this.role === 'owner' && this.newEventType === 'clubhouse') {
      event.status = 'pending';
      event.requestedBy = {
        flat: this.flatOwnerFlat,
        block: this.flatOwnerBlock || '',
        phone: this.flatOwnerPhone
      };
    }

    const eventRef = collection(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents`);

    if (this.editingEventId) {
      const docRef = doc(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents/${this.editingEventId}`);
      await updateDoc(docRef, event);
      this.editingEventId = null;
    } else {
      if (
        this.newEventType === 'clubhouse' &&
        this.events.some(e => e.date === datetime && e.type === 'clubhouse')
      ) {
        this.modalService.show('⚠️ That clubhouse slot is already reserved or pending approval!', 'warning');
        return;
      }
      await addDoc(eventRef, event);
      this.modalService.show('⚠️ That clubhouse slot is booked!','success');
    }

    this.clearForm();
    this.loadEvents();
  }

  loadEvents() {
    if (!this.apartmentId) {
      console.error('Missing apartmentId!');
      return;
    }
    const eventRef = collection(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents`);
    collectionData(eventRef, { idField: 'id' }).subscribe(data => {
      this.events = data.sort((a, b) => a['date'].localeCompare(b['date']));
    });
  }

  async deleteEvent(eventId: string) {
    if (!this.apartmentId) {
      console.error('Missing apartmentId!');
      return;
    }
    await deleteDoc(doc(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents/${eventId}`));
    this.loadEvents();
  }

  async approveEvent(eventId: string) {
    if (!this.apartmentId) {
      console.error('Missing apartmentId!');
      return;
    }
    await updateDoc(doc(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents/${eventId}`), { status: 'approved' });
    this.loadEvents();
  }

  async rejectEvent(eventId: string) {
    if (!this.apartmentId) {
      console.error('Missing apartmentId!');
      return;
    }
    await updateDoc(doc(this.firestoreService.getFirestore(), `apartments/${this.apartmentId}/calendarEvents/${eventId}`), { status: 'rejected' });
    this.loadEvents();
  }

  editEvent(event: any) {
    this.editingEventId = event.id;
    const [date, time] = event.date.split('T');
    this.selectedDate = date;
    this.selectedTime = time || '';
    this.newEventTitle = event.title;
    this.newEventType = event.type;
  }

  clearForm() {
    this.selectedDate = '';
    this.selectedTime = '';
    this.newEventTitle = '';
    this.newEventType = 'clubhouse';
    this.editingEventId = null;
  }
}
