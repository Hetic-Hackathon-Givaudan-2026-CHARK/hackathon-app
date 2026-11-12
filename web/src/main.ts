// Parcours du prototype (ADR 0007) : un écran de connexion, puis 5 étapes dans
// des <section> affichées une à une. Pas de framework : l'état tient dans
// `state`, et chaque étape a une fonction qui redessine sa section.
import './style.css';
import {
  api,
  ApiError,
  type Adjustments,
  type Client,
  type Project,
  type ProjectSummary,
  type Proposition,
  type Status,
  type Universe,
} from './api';
import {
  DEFAULT_ADJUSTMENTS,
  EXAMPLES,
  formatDate,
  SETTINGS,
  STATUS_LABELS,
  synthesis,
  TIMELINE,
  UNIVERSE_LABELS,
} from './labels';

type Step = 1 | 2 | 3 | 4 | 5;

const state = {
  client: null as Client | null,
  project: null as Project | null,
  projects: [] as ProjectSummary[],
  step: 1 as Step,
};

// --- Petits outils DOM ---

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

type Child = Node | string | null | undefined | false;

// Crée un élément. Les textes passent par des nœuds texte, jamais par
// innerHTML : un brief ou une réponse du LLM ne peut pas injecter de HTML.
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      element.addEventListener(key, value as EventListener);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else if (value !== false && value !== null && value !== undefined) {
      element.setAttribute(key, String(value));
    }
  }
  element.append(
    ...children.filter((child): child is Node | string => Boolean(child)),
  );
  return element;
}

const notice = $('#notice');

function notify(message = '') {
  notice.textContent = message;
  notice.hidden = message === '';
}

// Lance une action réseau : bouton désactivé pendant l'appel, message en cas
// d'erreur, retour à la connexion si la session a expiré.
async function run(
  button: HTMLButtonElement | null,
  busyLabel: string,
  action: () => Promise<void>,
) {
  const label = button?.textContent ?? '';
  if (button) {
    button.disabled = true;
    button.textContent = busyLabel;
    button.classList.add('is-busy');
  }
  notify();
  try {
    await action();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLogin('Votre session a expiré. Reconnectez-vous.');
    } else {
      notify(
        error instanceof ApiError
          ? error.message
          : "L'application ne répond pas. Réessayez dans un instant.",
      );
    }
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = label;
      button.classList.remove('is-busy');
    }
  }
}

// --- Navigation ---

const sections = [1, 2, 3, 4, 5].map((step) => $(`#step-${step}`));
const progressButtons = [
  ...document.querySelectorAll<HTMLButtonElement>('#progress button'),
];

const isDraft = () => state.project?.status === 'draft';
const selected = (): Proposition | undefined =>
  state.project?.propositions.find(
    (proposition) =>
      proposition.product.id === state.project?.selectedProductId,
  );

// Une étape n'est accessible que si le projet en cours le permet
function reachable(step: Step): boolean {
  const project = state.project;
  if (step === 2) return project !== null;
  if (step === 3) return selected() !== undefined;
  if (step === 5) return project !== null && project.status !== 'draft';
  return true;
}

const RENDER: Record<Step, () => void> = {
  1: renderBrief,
  2: renderPropositions,
  3: renderRefine,
  4: renderTracking,
  5: renderNextStep,
};

function show(step: Step) {
  state.step = reachable(step) ? step : 1;
  $('#login').hidden = true;
  $('#progress').hidden = false;
  sections.forEach((section, index) => {
    section.hidden = index + 1 !== state.step;
  });
  progressButtons.forEach((button, index) => {
    const n = (index + 1) as Step;
    button.disabled = !reachable(n);
    button.classList.toggle('is-done', n < state.step);
    if (n === state.step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  remember();
  RENDER[state.step]();
  window.scrollTo({ top: 0 });
}

// Après un rechargement de la page, on revient sur le même projet et la même
// étape (simple confort : l'état de référence reste côté serveur)
function remember() {
  try {
    sessionStorage.setItem(
      'parcours',
      JSON.stringify({ id: state.project?.id, step: state.step }),
    );
  } catch {
    // Stockage indisponible : on s'en passe
  }
}

function recall(): { id?: string; step?: Step } {
  try {
    return JSON.parse(sessionStorage.getItem('parcours') ?? '{}');
  } catch {
    return {};
  }
}

// --- Connexion ---

function showLogin(message = '') {
  state.client = null;
  state.project = null;
  clearInterval(shippingWatcher);
  $('#login').hidden = false;
  $('#progress').hidden = true;
  $('#account').hidden = true;
  sections.forEach((section) => (section.hidden = true));
  notify(message);
}

async function enter() {
  state.client = await api<Client>('GET', '/me');
  state.projects = await api<ProjectSummary[]>('GET', '/projects');
  $('#account-name').textContent =
    `${state.client.name} · ${state.client.company}`;
  $('#account').hidden = false;
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-account]',
)) {
  button.addEventListener('click', () =>
    run(null, '', async () => {
      await api('POST', '/session', { account: button.dataset.account });
      await enter();
      state.project = null;
      show(1);
    }),
  );
}

$('#logout').addEventListener('click', () =>
  run(null, '', async () => {
    await api('DELETE', '/session');
    sessionStorage.removeItem('parcours');
    showLogin();
  }),
);

progressButtons.forEach((button, index) =>
  button.addEventListener('click', () => show((index + 1) as Step)),
);

// --- Étape 1 : le besoin ---

const briefForm = $<HTMLFormElement>('#brief-form');
const briefField = $<HTMLTextAreaElement>('#brief');
const briefSubmit = $<HTMLButtonElement>('#brief-submit');

function renderBrief() {
  // Sur un brouillon, « Modifier mon besoin » relance les propositions du même
  // projet ; sinon on crée un nouveau projet.
  const draft = isDraft() ? state.project : null;
  briefField.value = draft?.brief ?? '';
  briefSubmit.textContent = draft
    ? 'Relancer les propositions'
    : 'Voir mes propositions';
  const context = $('#brief-context');
  context.hidden = draft === null;
  context.replaceChildren(
    `Vous modifiez le brief du brouillon « ${draft?.name ?? ''} ». `,
    h(
      'button',
      { type: 'button', class: 'link', click: startNewProject },
      'Démarrer un nouveau projet',
    ),
  );
  $('#brief-examples').replaceChildren(
    h('span', {}, 'Exemples :'),
    ...EXAMPLES.map((example) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip',
          click: () => {
            briefField.value = example;
            briefField.focus();
          },
        },
        example,
      ),
    ),
  );
}

function startNewProject() {
  state.project = null;
  show(1);
  briefField.focus();
}

briefForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const brief = briefField.value.trim();
  const draft = isDraft() ? state.project : null;
  run(briefSubmit, 'Analyse de votre besoin…', async () => {
    state.project = draft
      ? await api<Project>('POST', `/projects/${draft.id}/propositions`, {
          brief,
        })
      : await api<Project>('POST', '/projects', { brief });
    show(2);
  });
});

// --- Étape 2 : les propositions ---

function renderPropositions() {
  const project = state.project!;
  const editable = isDraft();
  const other: Universe =
    project.universe === 'flavor' ? 'fragrance' : 'flavor';

  $('#brief-recap').replaceChildren(
    h('p', { class: 'quote' }, `« ${project.brief} »`),
    h(
      'p',
      { class: 'hint' },
      `Parcours : ${UNIVERSE_LABELS[project.universe]}. `,
      // L'univers déduit du brief reste visible et corrigeable (ADR 0010)
      editable &&
        h(
          'button',
          {
            type: 'button',
            class: 'link',
            click: (event: Event) =>
              run(
                event.currentTarget as HTMLButtonElement,
                'Nouvelle recherche…',
                async () => {
                  state.project = await api<Project>(
                    'POST',
                    `/projects/${project.id}/propositions`,
                    { brief: project.brief, universe: other },
                  );
                  show(2);
                },
              ),
          },
          `Mon projet concerne plutôt les ${UNIVERSE_LABELS[other].toLowerCase()}`,
        ),
    ),
    editable
      ? h(
          'button',
          { type: 'button', class: 'secondary', click: () => show(1) },
          'Modifier mon besoin',
        )
      : '',
  );

  $('#propositions').replaceChildren(
    ...project.propositions.map((proposition) =>
      propositionCard(proposition, editable),
    ),
  );

  const next = $<HTMLButtonElement>('#to-refine');
  next.disabled = selected() === undefined;
  next.textContent = selected()
    ? `Affiner ${selected()!.product.name}`
    : 'Choisissez une référence pour continuer';
}

function propositionCard(proposition: Proposition, editable: boolean) {
  const { product } = proposition;
  const chosen = state.project!.selectedProductId === product.id;
  return h(
    'article',
    { class: chosen ? 'card is-selected' : 'card' },
    h(
      'p',
      { class: 'match' },
      h('strong', {}, `${proposition.matchScore} %`),
      ' de correspondance',
    ),
    h('span', {
      class: 'meter',
      style: `--value: ${proposition.matchScore}%`,
      'aria-hidden': 'true',
    }),
    h('h2', {}, product.name),
    h('p', { class: 'reference' }, product.reference),
    h('p', { class: 'summary' }, proposition.summary),
    h(
      'ul',
      { class: 'badges' },
      ...(product.badges ?? []).map((badge) => h('li', {}, badge)),
    ),
    proposition.profileHighlight &&
      h('p', { class: 'highlight' }, proposition.profileHighlight),
    proposition.glossary?.length
      ? h(
          'div',
          { class: 'block' },
          h('h3', {}, 'En clair'),
          h(
            'dl',
            {},
            ...proposition.glossary.flatMap((entry) => [
              h('dt', {}, entry.term),
              h('dd', {}, entry.plain),
            ]),
          ),
        )
      : null,
    h(
      'div',
      { class: 'block' },
      h('h3', {}, 'Pourquoi cette référence ?'),
      h('p', {}, proposition.reason),
    ),
    editable
      ? h(
          'button',
          {
            type: 'button',
            class: chosen ? 'primary' : 'secondary',
            'aria-pressed': String(chosen),
            click: (event: Event) =>
              run(
                event.currentTarget as HTMLButtonElement,
                'Un instant…',
                async () => {
                  state.project = await api<Project>(
                    'PATCH',
                    `/projects/${state.project!.id}`,
                    { selectedProductId: product.id },
                  );
                  renderPropositions();
                },
              ),
          },
          chosen ? 'Référence choisie' : 'Choisir cette référence',
        )
      : chosen && h('p', { class: 'chosen' }, 'Référence choisie'),
  );
}

$('#to-refine').addEventListener('click', () => show(3));

// --- Étape 3 : l'affinage ---

let adjustments: Required<Adjustments> = { ...DEFAULT_ADJUSTMENTS };
let saveTimer: number | undefined;

const adjustable = () =>
  state.project?.status === 'draft' ||
  state.project?.status === 'brief_validated';

function renderRefine() {
  const project = state.project!;
  const proposition = selected()!;
  const editable = adjustable();
  adjustments = { ...DEFAULT_ADJUSTMENTS, ...project.adjustments };

  $('#refine-lead').textContent = editable
    ? `Ajustez ${proposition.product.name} à votre projet : trois réglages, et vous voyez le résultat tout de suite.`
    : `Les réglages de ${proposition.product.name} sont figés : la suite du projet est lancée.`;

  $('#adjustments').replaceChildren(
    ...SETTINGS.map((setting) =>
      h(
        'fieldset',
        { disabled: !editable },
        h('legend', {}, setting.title),
        h(
          'div',
          { class: 'segments' },
          ...setting.levels.map((level) =>
            h(
              'label',
              {},
              h('input', {
                type: 'radio',
                name: setting.key,
                value: level.value,
                checked: adjustments[setting.key] === level.value,
              }),
              h('span', {}, level.label),
            ),
          ),
        ),
      ),
    ),
  );
  $('#save-state').textContent = '';
  renderSynthesis();

  const validate = $<HTMLButtonElement>('#validate-brief');
  validate.textContent = isDraft() ? 'Valider mon brief' : 'Voir le suivi';
  $('#back-to-propositions').hidden = !isDraft();
}

// La synthèse se calcule dans le navigateur, à chaque changement de réglage
function renderSynthesis() {
  const { text, tags } = synthesis(selected()!.product, adjustments);
  $('#synthesis-text').textContent = text;
  $('#synthesis-tags').replaceChildren(...tags.map((tag) => h('li', {}, tag)));
}

async function saveAdjustments() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  state.project = await api<Project>(
    'PATCH',
    `/projects/${state.project!.id}`,
    {
      adjustments,
    },
  );
  $('#save-state').textContent = 'Réglages enregistrés.';
}

$('#adjustments').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  adjustments = { ...adjustments, [input.name]: input.value };
  renderSynthesis();
  // Enregistrement par PATCH, regroupé si le client clique vite
  $('#save-state').textContent = 'Enregistrement…';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => run(null, '', saveAdjustments), 400);
});

$('#back-to-propositions').addEventListener('click', () => show(2));

$<HTMLButtonElement>('#validate-brief').addEventListener('click', (event) =>
  run(event.currentTarget as HTMLButtonElement, 'Validation…', async () => {
    if (saveTimer !== undefined) await saveAdjustments();
    if (isDraft()) {
      state.project = await api<Project>(
        'PATCH',
        `/projects/${state.project!.id}`,
        { adjustments, status: 'brief_validated' },
      );
    }
    show(4);
  }),
);

// --- Étape 4 : le suivi ---

// La frise : brief validé → échantillon en préparation → expédié → test en cours
function timeline(status: Status) {
  const reached = TIMELINE.indexOf(
    status === 'expert_requested' ? 'brief_validated' : status,
  );
  return h(
    'ol',
    { class: 'timeline' },
    ...TIMELINE.map((step, index) =>
      h(
        'li',
        {
          class:
            index < reached ? 'is-done' : index === reached ? 'is-current' : '',
          'aria-current': index === reached ? 'step' : null,
        },
        STATUS_LABELS[step],
      ),
    ),
  );
}

function projectPanel(project: Project) {
  const proposition = selected();
  return h(
    'div',
    { class: 'panel' },
    h(
      'p',
      { class: 'panel-head' },
      h('strong', {}, project.name),
      h('span', { class: 'status' }, STATUS_LABELS[project.status]),
    ),
    proposition &&
      h(
        'p',
        { class: 'hint' },
        `${proposition.product.name} (${proposition.product.reference}) · ${UNIVERSE_LABELS[project.universe]}`,
      ),
    timeline(project.status),
    project.status === 'expert_requested' &&
      h('p', {}, 'Un expert Givaudan reprend votre brief et vous recontacte.'),
    project.estimatedDelivery &&
      h(
        'p',
        {},
        `Livraison estimée de l'échantillon : ${formatDate(project.estimatedDelivery)}.`,
      ),
  );
}

function renderTracking() {
  const project = state.project;
  const tracking = $('#tracking');
  if (!project) {
    tracking.replaceChildren(
      h(
        'p',
        { class: 'hint' },
        'Aucun projet ouvert. Choisissez un projet enregistré ou démarrez-en un nouveau.',
      ),
    );
  } else if (project.status === 'draft') {
    tracking.replaceChildren(
      h(
        'div',
        { class: 'panel' },
        h(
          'p',
          { class: 'panel-head' },
          h('strong', {}, project.name),
          h('span', { class: 'status' }, STATUS_LABELS.draft),
        ),
        h(
          'p',
          {},
          'Ce projet est encore un brouillon : le suivi commence quand le brief est validé.',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'primary',
            click: () => show(selected() ? 3 : 2),
          },
          'Reprendre ce brouillon',
        ),
      ),
    );
  } else {
    tracking.replaceChildren(
      projectPanel(project),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          { type: 'button', class: 'primary', click: () => show(5) },
          project.status === 'brief_validated'
            ? 'Choisir la suite : échantillon ou expert'
            : 'Voir ma demande',
        ),
      ),
    );
  }
  renderProjectList();
  // La liste est relue à chaque affichage : elle ne contient que les projets
  // du client de la session, le filtrage est fait par l'API.
  api<ProjectSummary[]>('GET', '/projects')
    .then((projects) => {
      state.projects = projects;
      renderProjectList();
    })
    .catch(() => undefined);
}

function renderProjectList() {
  $('#project-list').replaceChildren(
    ...state.projects.map((summary) =>
      h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: summary.id === state.project?.id ? 'is-open' : '',
            click: () => openProject(summary.id),
          },
          h('strong', {}, summary.name),
          h('span', { class: 'status' }, STATUS_LABELS[summary.status]),
          h(
            'span',
            { class: 'hint' },
            `Mis à jour le ${formatDate(summary.updatedAt)}`,
          ),
        ),
      ),
    ),
  );
  if (state.projects.length === 0) {
    $('#project-list').append(
      h('li', { class: 'hint' }, 'Aucun projet enregistré pour le moment.'),
    );
  }
}

function openProject(id: string) {
  run(null, '', async () => {
    state.project = await api<Project>('GET', `/projects/${id}`);
    show(isDraft() ? (selected() ? 3 : 2) : 4);
  });
}

$('#new-project').addEventListener('click', startNewProject);

// --- Étape 5 : échantillon gratuit ou expert ---

function chooseNextStep(choice: 'sample' | 'expert', busyLabel: string) {
  return (event: Event) =>
    run(event.currentTarget as HTMLButtonElement, busyLabel, async () => {
      state.project = await api<Project>(
        'POST',
        `/projects/${state.project!.id}/next-step`,
        { choice },
      );
      renderNextStep();
      if (choice === 'sample') watchShipping();
    });
}

function renderNextStep() {
  const project = state.project!;
  const product = selected()?.product;
  const sampleButton = h(
    'button',
    {
      type: 'button',
      class: 'primary',
      click: chooseNextStep('sample', 'Commande en cours…'),
    },
    'Commander mon échantillon gratuit',
  );

  if (project.status === 'brief_validated') {
    $('#next-step').replaceChildren(
      h(
        'p',
        { class: 'lead' },
        `Votre brief est validé${product ? ` pour ${product.name}` : ''}. Choisissez la suite.`,
      ),
      h(
        'div',
        { class: 'choices' },
        h(
          'article',
          { class: 'card' },
          h('h2', {}, 'Recevoir un échantillon gratuit'),
          h(
            'p',
            {},
            'Nous préparons un échantillon avec vos réglages. Vous le testez dans votre produit avant toute commande.',
          ),
          sampleButton,
        ),
        h(
          'article',
          { class: 'card' },
          h('h2', {}, 'Parler à un expert'),
          h(
            'p',
            {},
            product?.badges?.includes('Diffusion restreinte')
              ? 'Cette référence est en diffusion restreinte : un expert confirme avec vous son éligibilité et affine le brief.'
              : 'Un doute sur la référence ou les réglages ? Un expert reprend votre brief avec vous.',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'secondary',
              click: chooseNextStep('expert', 'Demande en cours…'),
            },
            'Demander un expert',
          ),
        ),
      ),
    );
    return;
  }

  const expert = project.status === 'expert_requested';
  $('#next-step').replaceChildren(
    h(
      'p',
      { class: 'lead' },
      expert
        ? 'Votre demande est transmise à un expert.'
        : 'Votre échantillon gratuit est commandé.',
    ),
    projectPanel(project),
    h(
      'div',
      { class: 'actions' },
      h(
        'button',
        { type: 'button', class: 'secondary', click: () => show(4) },
        'Voir mes projets',
      ),
      expert && sampleButton,
    ),
  );
}

// SIMULATION DE DÉMO : le prototype n'a pas de logistique. Après « Commander
// mon échantillon gratuit », l'API fait passer le projet à « expédié » au bout
// de quelques secondes (simulateShipping dans api/src/projects.ts). Ici, on
// relit le projet toutes les 2 s, 30 s au plus, pour que la frise avance sous
// les yeux du client. Un vrai suivi viendrait du système de commande.
let shippingWatcher: number | undefined;

function watchShipping() {
  clearInterval(shippingWatcher);
  let tries = 0;
  shippingWatcher = window.setInterval(async () => {
    const project = state.project;
    if (!project || project.status !== 'sample_preparing' || ++tries > 15) {
      clearInterval(shippingWatcher);
      return;
    }
    const fresh = await api<Project>('GET', `/projects/${project.id}`).catch(
      () => null,
    );
    if (
      fresh &&
      fresh.id === state.project?.id &&
      fresh.status !== project.status
    ) {
      state.project = fresh;
      if (state.step === 4 || state.step === 5) RENDER[state.step]();
    }
  }, 2000);
}

// --- Démarrage : session déjà ouverte ? ---

enter()
  .then(async () => {
    const { id, step } = recall();
    if (id) {
      state.project = await api<Project>('GET', `/projects/${id}`).catch(
        () => null,
      );
    }
    show(state.project && step ? step : 1);
  })
  .catch(() => showLogin());
