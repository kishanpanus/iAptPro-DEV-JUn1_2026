import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FirestoreService } from '../../services/services/firestore.service';
import { collection, doc, onSnapshot, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';

@Component({
  selector: 'app-security-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './security-dashboard.component.html',
  styleUrl: './security-dashboard.component.css'
})
export class SecurityDashboardComponent  implements OnInit {
  gatePasses: any[] = [];

  constructor(private firestoreService: FirestoreService) {}
  ngOnInit(): void {
    const firestore = this.firestoreService.getFirestore();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const passRef = collection(firestore, 'gatePasses');
    const q = query(passRef, where('expectedTime', '>=', Timestamp.fromDate(todayStart)), orderBy('expectedTime'));

    onSnapshot(q, snapshot => {
      this.gatePasses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });
  }

  markAsDelivered(passId: string) {
    const firestore = this.firestoreService.getFirestore();
    const docRef = doc(firestore, `gatePasses/${passId}`);
    updateDoc(docRef, { status: 'delivered' });
  }
}

