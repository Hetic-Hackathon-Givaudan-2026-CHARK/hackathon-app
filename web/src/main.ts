// Parcours du prototype (ADR 0007), aligné sur les wireframes « Maquettes
// Givaudan G10 » : un écran de connexion, puis 5 étapes dans des <section>
// affichées une à une. Pas de framework : l'état tient dans `state`, et chaque
// étape a une fonction qui redessine sa section.
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
  levelIndex,
  PROFILE_LABELS,
  SETTINGS,
  type Setting,
  STATUS_LABELS,
  synthesisLines,
  TIMELINE,
  UNIVERSE_LABELS,
} from './labels';

type Step = 1 | 2 | 3 | 4 | 5;

const state = {
  client: null as Client | null,
  project: null as Project | null,
  projects: [] as ProjectSummary[],
  step: 1 as Step,
  // Référence affichée dans le détail de l'écran 2 (pas encore enregistrée)
  viewedId: null as string | null,
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
  element.append(...nodes(children));
  return element;
}

// Retire les enfants vides (false, null, undefined) avant de les insérer
const nodes = (children: Child[]): (Node | string)[] =>
  children.filter((child): child is Node | string => Boolean(child));

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
    // Si l'étape a redessiné le bouton entre-temps, on ne le touche plus
    if (button?.classList.contains('is-busy')) {
      button.disabled = false;
      button.textContent = label;
      button.classList.remove('is-busy');
    }
  }
}

const clicked = (event: Event) => event.currentTarget as HTMLButtonElement;

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
const productLabel = (proposition: Proposition) =>
  `${proposition.product.name} ${proposition.product.reference}`;

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

function forget() {
  try {
    sessionStorage.removeItem('parcours');
  } catch {
    // Stockage indisponible : rien à effacer
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
    forget();
    showLogin();
  }),
);

progressButtons.forEach((button, index) =>
  button.addEventListener('click', () => show((index + 1) as Step)),
);

// --- Étape 1 : préciser le besoin ---

const briefField = $<HTMLTextAreaElement>('#brief');
const briefSubmit = $<HTMLButtonElement>('#brief-submit');

function renderBrief() {
  // Sur un brouillon, « Modifier mon besoin » relance les propositions du même
  // projet ; sinon on crée un nouveau projet.
  const draft = isDraft() ? state.project : null;
  briefField.value = draft?.brief ?? '';
  briefSubmit.textContent = draft
    ? 'Relancer les propositions →'
    : 'Voir mes propositions →';
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
    ...EXAMPLES.map((example) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip',
          title: example.brief,
          click: () => {
            briefField.value = example.brief;
            briefField.focus();
          },
        },
        example.label,
      ),
    ),
  );
}

function startNewProject() {
  state.project = null;
  show(1);
  briefField.focus();
}

$<HTMLFormElement>('#brief-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const brief = briefField.value.trim();
  const draft = isDraft() ? state.project : null;
  run(briefSubmit, 'Analyse de votre besoin…', async () => {
    state.project = draft
      ? await api<Project>('POST', `/projects/${draft.id}/propositions`, {
          brief,
        })
      : await api<Project>('POST', '/projects', { brief });
    state.viewedId = null;
    show(2);
  });
});

// --- Étape 2 : visualiser les propositions et comprendre ---

// La carte affichée : celle que le client regarde, sinon la référence déjà
// choisie, sinon la meilleure proposition
function viewed(): Proposition | undefined {
  const propositions = state.project?.propositions ?? [];
  const find = (id?: string | null) =>
    propositions.find((proposition) => proposition.product.id === id);
  return (
    find(state.viewedId) ??
    find(state.project?.selectedProductId) ??
    propositions[0]
  );
}

function renderPropositions() {
  const project = state.project!;
  const editable = isDraft();
  const current = viewed();
  state.viewedId = current?.product.id ?? null;
  const other: Universe =
    project.universe === 'flavor' ? 'fragrance' : 'flavor';

  $('#brief-recap').textContent =
    `Votre brief : ${project.brief} · ${project.propositions.length} références proposées`;

  // L'univers déduit du brief reste visible et corrigeable (ADR 0010)
  $('#universe-line').replaceChildren(
    ...nodes([
      `Parcours ${UNIVERSE_LABELS[project.universe]}. `,
      editable &&
        h(
          'button',
          {
            type: 'button',
            class: 'link',
            click: (event: Event) =>
              run(clicked(event), 'Nouvelle recherche…', async () => {
                state.project = await api<Project>(
                  'POST',
                  `/projects/${project.id}/propositions`,
                  { brief: project.brief, universe: other },
                );
                state.viewedId = null;
                show(2);
              }),
          },
          `Mon projet concerne plutôt les ${UNIVERSE_LABELS[other].toLowerCase()}`,
        ),
    ]),
  );

  $('#proposition-list').replaceChildren(
    ...project.propositions.map((proposition) =>
      pickerItem(proposition, proposition === current),
    ),
  );
  $('#proposition-detail').replaceChildren(
    ...nodes(
      current
        ? propositionDetail(current, editable)
        : [h('p', { class: 'hint' }, 'Aucune proposition pour ce brief.')],
    ),
  );

  $('#edit-brief').hidden = !editable;
  const next = $<HTMLButtonElement>('#to-refine');
  next.disabled = !current || (!editable && !selected());
  next.textContent = editable
    ? 'Affiner cette proposition →'
    : 'Voir le profil affiné →';
}

function pickerItem(proposition: Proposition, active: boolean) {
  return h(
    'li',
    {},
    h(
      'button',
      {
        type: 'button',
        class: active ? 'pick is-active' : 'pick',
        'aria-pressed': String(active),
        click: () => {
          state.viewedId = proposition.product.id;
          renderPropositions();
        },
      },
      h('strong', { class: 'pick-name' }, productLabel(proposition)),
      h('span', { class: 'pick-score' }, `${proposition.matchScore} % Match`),
      h('span', { class: 'pick-summary' }, proposition.summary),
      h(
        'span',
        { class: 'pick-cta' },
        active ? 'Sélectionnée' : 'Voir le détail →',
      ),
    ),
  );
}

function propositionDetail(
  proposition: Proposition,
  editable: boolean,
): Child[] {
  const { product } = proposition;
  const chosen = state.project?.selectedProductId === product.id;
  const eyebrow = editable
    ? 'Référence sélectionnée'
    : chosen
      ? 'Référence retenue pour votre projet'
      : 'Autre proposition';
  return [
    h('p', { class: 'eyebrow' }, eyebrow),
    h('h2', { class: 'detail-name' }, productLabel(proposition)),
    h(
      'p',
      { class: 'detail-score' },
      `${proposition.matchScore} % Match avec votre brief`,
    ),
    h(
      'ul',
      { class: 'tags' },
      ...(product.badges ?? []).map((badge) => h('li', {}, badge)),
    ),
    h('h3', {}, PROFILE_LABELS[product.universe]),
    h(
      'p',
      { class: 'highlight' },
      proposition.profileHighlight || product.profile,
    ),
    proposition.glossary?.length
      ? h(
          'div',
          { class: 'plain' },
          ...proposition.glossary.map((entry) =>
            h(
              'div',
              {},
              h('p', { class: 'plain-term' }, `En clair : ${entry.term}`),
              h('p', { class: 'hint' }, entry.plain),
            ),
          ),
        )
      : null,
    h('h3', {}, 'Pourquoi cette référence ?'),
    h('p', { class: 'reason' }, proposition.reason),
  ];
}

$('#edit-brief').addEventListener('click', () => show(1));

$<HTMLButtonElement>('#to-refine').addEventListener('click', (event) =>
  run(clicked(event), 'Un instant…', async () => {
    // Le choix n'est enregistré qu'ici, au passage à l'affinage
    const id = state.viewedId;
    if (isDraft() && id && id !== state.project!.selectedProductId) {
      state.project = await api<Project>(
        'PATCH',
        `/projects/${state.project!.id}`,
        { selectedProductId: id },
      );
    }
    show(3);
  }),
);

// --- Étape 3 : affiner après les propositions ---

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

  $('#refine-lead').textContent =
    `Base sélectionnée : ${productLabel(proposition)} · ${project.name}`;
  $('#refine-hint').textContent = editable
    ? 'Faites glisser chaque curseur : trois niveaux par réglage.'
    : 'La suite du projet est lancée : ces réglages sont figés.';
  $('#sliders').replaceChildren(
    ...SETTINGS.map((setting) => slider(setting, editable)),
  );
  $('#save-state').textContent = '';
  renderSynthesis();

  $('#validate-brief').textContent = isDraft()
    ? 'Valider mon brief et suivre →'
    : 'Voir le suivi →';
}

function slider(setting: Setting, editable: boolean) {
  const index = levelIndex(setting, adjustments[setting.key]);
  const id = `slider-${setting.key}`;
  return h(
    'div',
    { class: 'slider' },
    h(
      'div',
      { class: 'slider-head' },
      h('label', { for: id }, setting.title),
      h(
        'output',
        { for: id, id: `out-${setting.key}` },
        setting.levels[index].label,
      ),
    ),
    h('input', {
      type: 'range',
      id,
      name: setting.key,
      min: '0',
      max: '2',
      step: '1',
      value: String(index),
      disabled: !editable,
      'aria-valuetext': setting.levels[index].label,
      style: `--fill: ${index * 50}%`,
    }),
    h(
      'div',
      { class: 'slider-ends', 'aria-hidden': 'true' },
      h('span', {}, setting.ends[0]),
      h('span', {}, setting.ends[1]),
    ),
  );
}

// La synthèse se calcule dans le navigateur, à chaque mouvement de curseur
function renderSynthesis() {
  $('#synthesis-base').textContent = `Base : ${productLabel(selected()!)}`;
  $('#synthesis-lines').replaceChildren(
    ...synthesisLines(adjustments).map((line) => h('li', {}, line)),
  );
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
  $('#save-state').textContent = 'Préférences enregistrées.';
}

$('#sliders').addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  const setting = SETTINGS.find((candidate) => candidate.key === input.name);
  if (!setting) return;
  const index = Number(input.value);
  const level = setting.levels[index];
  adjustments = { ...adjustments, [setting.key]: level.value };
  input.setAttribute('aria-valuetext', level.label);
  input.style.setProperty('--fill', `${index * 50}%`);
  $(`#out-${setting.key}`).textContent = level.label;
  renderSynthesis();
  // Enregistrement par PATCH, regroupé pendant que le curseur bouge
  $('#save-state').textContent = 'Enregistrement…';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => run(null, '', saveAdjustments), 400);
});

$('#back-to-propositions').addEventListener('click', () => show(2));

$<HTMLButtonElement>('#validate-brief').addEventListener('click', (event) =>
  run(clicked(event), 'Validation…', async () => {
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

// --- Étape 4 : suivre sa demande ---

function panelCopy(project: Project): { title: string; text: string } {
  const delivery = project.estimatedDelivery
    ? `Livraison estimée le ${formatDate(project.estimatedDelivery)}.`
    : '';
  switch (project.status) {
    case 'draft':
      return {
        title: 'Brouillon',
        text: 'Le suivi commence quand le brief est validé.',
      };
    case 'brief_validated':
      return {
        title: 'Brief validé · À vous de choisir la suite',
        text: 'La préparation de votre échantillon démarrera après votre commande.',
      };
    case 'sample_preparing':
      return {
        title: 'Échantillon en préparation',
        text: delivery || 'Nous préparons votre échantillon avec vos réglages.',
      };
    case 'shipped':
      return {
        title: 'Échantillon expédié',
        text: delivery || 'Votre échantillon est en route.',
      };
    case 'testing':
      return {
        title: 'Test en cours',
        text: "Testez l'échantillon dans votre produit, puis partagez votre retour.",
      };
    case 'expert_requested':
      return {
        title: 'Brief validé · Expert demandé',
        text: 'Un expert Givaudan reprend votre brief et vous recontacte.',
      };
  }
}

// La frise : brief validé → échantillon en préparation → expédié → test en cours
function timeline(status: Status) {
  const reached =
    status === 'draft'
      ? -1
      : TIMELINE.findIndex(
          (step) =>
            step.status ===
            (status === 'expert_requested' ? 'brief_validated' : status),
        );
  const stepState = (index: number, waiting: string) => {
    if (index < reached || (index === 0 && reached === 0)) return 'Terminé';
    return index === reached ? 'En cours' : waiting;
  };
  return h(
    'ol',
    { class: 'timeline' },
    ...TIMELINE.map((step, index) =>
      h(
        'li',
        {
          class: index <= reached ? 'is-done' : '',
          'aria-current': index === reached ? 'step' : null,
        },
        h(
          'span',
          { class: 'timeline-num', 'aria-hidden': 'true' },
          String(index + 1),
        ),
        h('strong', {}, step.label),
        h('span', { class: 'hint' }, stepState(index, step.waiting)),
      ),
    ),
  );
}

// Ce qui est simulé se dit à l'écran, pas seulement dans le README : le
// prototype n'a ni logistique ni file d'attente d'experts.
function simulationNote(status: Status): string | null {
  switch (status) {
    case 'sample_preparing':
    case 'shipped':
    case 'testing':
      return "Démonstration : la préparation et l'expédition sont simulées, aucun colis ne part.";
    case 'expert_requested':
      return "Démonstration : la demande est enregistrée, mais aucun expert n'est prévenu.";
    default:
      return null;
  }
}

function statusPanel(project: Project) {
  const { title, text } = panelCopy(project);
  const note = simulationNote(project.status);
  return h(
    'div',
    { class: 'box box-soft status-panel' },
    h('h2', {}, title),
    h('p', { class: 'hint' }, text),
    timeline(project.status),
    note ? h('p', { class: 'hint simulation-note' }, note) : null,
  );
}

// Le bouton principal de la barre d'actions dépend du projet ouvert
let trackingAction: () => void = () => undefined;

function renderTracking() {
  const project = state.project;
  const proposition = selected();
  $('#tracking-lead').textContent = project
    ? [project.name, proposition && productLabel(proposition)]
        .filter(Boolean)
        .join(' · ')
    : 'Retrouvez ici tous vos projets enregistrés.';

  $('#tracking').replaceChildren(
    project
      ? statusPanel(project)
      : h(
          'div',
          { class: 'box box-soft' },
          h(
            'p',
            {},
            'Aucun projet ouvert. Choisissez un projet enregistré ou démarrez-en un nouveau.',
          ),
        ),
  );

  const action = $<HTMLButtonElement>('#tracking-action');
  if (!project) {
    action.textContent = 'Démarrer un projet →';
    trackingAction = startNewProject;
  } else if (project.status === 'draft') {
    action.textContent = 'Reprendre ce brouillon →';
    trackingAction = () => show(proposition ? 3 : 2);
  } else {
    action.textContent =
      project.status === 'brief_validated'
        ? 'Choisir la prochaine étape →'
        : 'Voir ma demande →';
    trackingAction = () => show(5);
  }
  $('#back-to-refine').hidden = !proposition;

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
  const rows = state.projects.map((summary) => {
    const open = summary.id === state.project?.id;
    return h(
      'tr',
      { class: open ? 'is-open' : '' },
      h(
        'th',
        { scope: 'row' },
        h('span', { class: 'project-name' }, summary.name),
        h(
          'span',
          { class: 'updated' },
          `Mis à jour le ${formatDate(summary.updatedAt)}`,
        ),
      ),
      h('td', { class: 'hint' }, STATUS_LABELS[summary.status]),
      h(
        'td',
        {},
        open
          ? h('strong', {}, 'Projet ouvert')
          : h(
              'button',
              {
                type: 'button',
                class: 'link-strong',
                'aria-label': `Ouvrir ${summary.name}`,
                click: () => openProject(summary.id),
              },
              'Ouvrir →',
            ),
      ),
    );
  });
  $('#project-list').replaceChildren(
    ...(rows.length > 0
      ? rows
      : [
          h(
            'tr',
            {},
            h(
              'td',
              { colspan: '3', class: 'hint' },
              'Aucun projet enregistré pour le moment.',
            ),
          ),
        ]),
  );
}

function openProject(id: string) {
  run(null, '', async () => {
    state.project = await api<Project>('GET', `/projects/${id}`);
    state.viewedId = null;
    show(isDraft() ? (selected() ? 3 : 2) : 4);
  });
}

$('#tracking-action').addEventListener('click', () => trackingAction());
$('#back-to-refine').addEventListener('click', () => show(3));
$('#new-project').addEventListener('click', startNewProject);

// --- Étape 5 : recevoir un échantillon ou contacter un expert ---

function chooseNextStep(choice: 'sample' | 'expert', busyLabel: string) {
  return (event: Event) =>
    run(clicked(event), busyLabel, async () => {
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
  const proposition = selected();

  const recap = h(
    'div',
    { class: 'box box-soft recap' },
    h('strong', {}, project.name),
    h(
      'p',
      { class: 'hint' },
      [
        proposition && productLabel(proposition),
        STATUS_LABELS[project.status],
        project.adjustments && "Préférences définies à l'étape d'affinage",
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  );

  const sampleCard = h(
    'article',
    { class: 'box choice' },
    h('p', { class: 'eyebrow' }, '01 / Tester'),
    h('h2', {}, 'Recevoir mon échantillon'),
    h(
      'p',
      { class: 'hint' },
      'Évaluez la proposition dans votre application et partagez votre retour depuis le suivi.',
    ),
    h('p', { class: 'choice-note' }, 'Échantillon gratuit · Sans engagement'),
    h(
      'button',
      {
        type: 'button',
        class: 'primary wide',
        click: chooseNextStep('sample', 'Commande en cours…'),
      },
      'Commander mon échantillon gratuit',
    ),
  );

  const restricted =
    proposition?.product.badges?.includes('Diffusion restreinte') ?? false;
  const expertCard = h(
    'article',
    { class: 'box choice' },
    h('p', { class: 'eyebrow' }, '02 / Être accompagné'),
    h('h2', {}, 'Échanger avec un expert'),
    h(
      'p',
      { class: 'hint' },
      restricted
        ? 'Cette référence est en diffusion restreinte : un spécialiste confirme son éligibilité et vous aide à préciser le profil.'
        : 'Un spécialiste vous aide à préciser le profil et à comprendre les contraintes techniques.',
    ),
    h('p', { class: 'choice-note' }, 'Votre brief sera joint à la demande'),
    h(
      'button',
      {
        type: 'button',
        class: 'primary wide',
        click: chooseNextStep('expert', 'Demande en cours…'),
      },
      "Demander l'avis d'un expert Givaudan",
    ),
  );

  const lead = $('#next-lead');
  const footnote = $('#next-footnote');
  if (project.status === 'brief_validated') {
    lead.textContent = 'Choisissez le parcours le plus adapté à votre projet.';
    footnote.hidden = false;
    $('#next-step').replaceChildren(
      recap,
      h('div', { class: 'choices' }, sampleCard, expertCard),
    );
  } else if (project.status === 'expert_requested') {
    // Commander l'échantillon reste possible après avoir demandé un expert
    lead.textContent = 'Votre demande est transmise à un expert Givaudan.';
    footnote.hidden = false;
    $('#next-step').replaceChildren(
      recap,
      statusPanel(project),
      h('div', { class: 'choices' }, sampleCard),
    );
  } else {
    lead.textContent = 'Votre échantillon gratuit est commandé.';
    footnote.hidden = true;
    $('#next-step').replaceChildren(recap, statusPanel(project));
  }
}

$('#back-to-tracking').addEventListener('click', () => show(4));

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
