
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modalNuevoCliente');
    const openBtn = document.getElementById('btnNuevoCliente');
    const closeBtn = document.querySelector('.modal-close');
  
    openBtn?.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
  
    closeBtn?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
  