// Les écrans du parcours (connexion puis 5 étapes) arrivent avec la branche
// feature/front-parcours : en attendant, on vérifie seulement que l'API répond.
const health = document.querySelector('#health')!;

fetch('/api/health')
  .then((response) => response.json())
  .then((status) => {
    health.textContent = `API OK · ${status.db}`;
  })
  .catch(() => {
    health.textContent = 'API injoignable';
  });
