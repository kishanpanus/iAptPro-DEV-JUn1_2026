import { Injectable } from '@angular/core';

declare var bootstrap: any;

@Injectable({ providedIn: 'root' })
export class ModalService {
    private confirmResolve!: (result: boolean) => void;
  
    show(
      message: string,
      type: 'success' | 'error' | 'warning' | 'info' | 'confirm' = 'success',
      title = '',
      onClose?: () => void
    ): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        const modalEl = document.getElementById('globalModal');
        if (!modalEl) {
          console.error('Global modal element not found.');
          return resolve(false);
        }
    
        const modalBody = modalEl.querySelector('.modal-body');
        const modalIcon = modalEl.querySelector('.modal-icon');
        const confirmBtn = modalEl.querySelector('.modal-confirm-btn') as HTMLButtonElement;
        const cancelBtn = modalEl.querySelector('.modal-cancel-btn') as HTMLButtonElement;
    
        if (!modalBody || !modalIcon || !confirmBtn || !cancelBtn) {
          console.error('One or more modal elements are missing.');
          return resolve(false);
        }
    
        // Set icon and message
        const iconMap = {
          success: '✅',
          error: '❌',
          warning: '⚠️',
          confirm: '❓',
          info: 'ℹ️'
        };
    
        modalIcon.textContent = iconMap[type] || '';
        modalBody.textContent = message;
    
        // Set class
        modalEl.classList.remove('modal-success', 'modal-error', 'modal-warning', 'modal-info', 'modal-confirm');
        modalEl.classList.add(`modal-${type}`);
    
        // Show or hide confirm buttons
        const isConfirm = type === 'confirm';
        confirmBtn.style.display = isConfirm ? 'inline-block' : 'none';
        cancelBtn.style.display = isConfirm ? 'inline-block' : 'none';
    
        // Clean old listeners
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    
        const modal = new bootstrap.Modal(modalEl);
    
        // When modal closes
        modalEl.addEventListener(
          'hidden.bs.modal',
          () => {
            modal.dispose();
            document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
            if (onClose) onClose();
          },
          { once: true }
        );
    
        if (isConfirm) {
          confirmBtn.onclick = () => {
            modal.hide();
            resolve(true);
          };
    
          cancelBtn.onclick = () => {
            modal.hide();
            resolve(false);
          };
    
          modal.show();
        } else {
          modal.show();
          setTimeout(() => {
            modal.hide();
            resolve(true);
          }, 4000);
        }
      });
    }
    
    
  }
  