'use strict';

const byId = id => document.getElementById(id);
const scene = byId('scene');
const canvas = byId('road');
const road = canvas.getContext('2d');
const runner = byId('runner');
const start = byId('start');
const openSettings = byId('open-settings');
const settingsForm = byId('settings-form');
const settingsError = byId('settings-error');
const operationInputs = Array.from(settingsForm.elements.operations);
const gates = Array.from(document.querySelectorAll('.gate'));
const timer = byId('timer');
const timeLimit = byId('time-limit');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const bestKey = 'linkday-011-best';
const settingsKey = 'linkday-011-settings';
const speeds = { slow: { seconds: 12, pace: .75 }, normal: { seconds: 9, pace: 1 }, fast: { seconds: 6, pace: 1.5 } };
const levels = {
  easy: { numbers: [1, 9], factors: [2, 5] },
  normal: { numbers: [10, 49], factors: [2, 9] },
  hard: { numbers: [25, 99], factors: [4, 12] },
};
const defaults = { speed: 'normal', level: 'easy', operations: ['+', '−'] };
const crossingTime = .58;
const returnStart = .69;
const returnEnd = .94;

let settings = loadSettings();
let state = 'ready';
let score = 0;
let best = 0;
let question;
let elapsed = 0;
let duration = speeds[settings.speed].seconds;
let feedback = 0;
let chosenProgress = 0;
let selectedIndex = -1;
let travel = 0;
let runTime = 0;
let lastFrame = 0;
let shownFrame = -1;
let sceneWidth = 0;
let sceneHeight = 0;

try {
  best = Math.max(0, Number.parseInt(localStorage.getItem(bestKey), 10) || 0);
} catch {
  // The game still works without browser storage.
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    if (saved && Object.hasOwn(speeds, saved.speed) && Object.hasOwn(levels, saved.level) && Array.isArray(saved.operations)) {
      const operations = operationInputs.map(input => input.value).filter(value => saved.operations.includes(value));
      if (operations.length) return { speed: saved.speed, level: saved.level, operations };
    }
  } catch {
    // Default settings also cover unavailable storage and corrupt values.
  }
  return defaults;
}

function showSettings(show) {
  if (show) {
    settingsForm.elements.speed.value = settings.speed;
    settingsForm.elements.level.value = settings.level;
    operationInputs.forEach(input => { input.checked = settings.operations.includes(input.value); });
    settingsError.hidden = true;
  }
  byId('game-view').hidden = show;
  byId('settings-view').hidden = !show;
  (show ? byId('settings-title') : openSettings).focus();
}

function saveSettings(event) {
  event.preventDefault();
  const values = new FormData(settingsForm);
  const operations = values.getAll('operations');
  if (!operations.length) {
    settingsError.textContent = '연산 종류를 하나 이상 골라 주세요.';
    settingsError.hidden = false;
    operationInputs[0].focus();
    return;
  }
  settings = { speed: values.get('speed'), level: values.get('level'), operations };
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    // The selected settings still apply for this visit.
  }
  showSettings(false);
}

function refreshScores() {
  byId('score').textContent = String(score).padStart(2, '0');
  byId('best').textContent = String(best).padStart(2, '0');
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function makeQuestion() {
  const operator = settings.operations[randomInt(0, settings.operations.length - 1)];
  const { numbers, factors } = levels[settings.level];
  let a;
  let b;
  let result;

  switch (operator) {
    case '+':
      a = randomInt(...numbers);
      b = randomInt(...numbers);
      result = a + b;
      break;
    case '−':
      a = randomInt(...numbers);
      b = randomInt(...numbers);
      if (a < b) [a, b] = [b, a];
      result = a - b;
      break;
    case '×':
      a = randomInt(...factors);
      b = randomInt(...factors);
      result = a * b;
      break;
    default:
      b = randomInt(...factors);
      result = randomInt(...factors);
      a = b * result;
      break;
  }

  let distractor = result + randomInt(1, 4) * (Math.random() < .5 ? 1 : -1);
  if (distractor < 0) distractor = result + randomInt(1, 4);
  const correctIndex = randomInt(0, 1);
  return {
    text: a + ' ' + operator + ' ' + b,
    result,
    correctIndex,
    values: correctIndex === 0 ? [result, distractor] : [distractor, result],
  };
}

function setState(next) {
  state = next;
  scene.dataset.state = next;
  gates.forEach(button => { button.disabled = next !== 'running'; });
  start.disabled = openSettings.disabled = next === 'running' || next === 'feedback';
  timeLimit.hidden = next !== 'running';
}

function nextQuestion() {
  const previous = question?.text;
  do {
    question = makeQuestion();
  } while (question.text === previous);

  duration = speeds[settings.speed].seconds;
  elapsed = 0;
  selectedIndex = -1;
  gates.forEach(button => button.classList.remove('chosen', 'incorrect'));
  byId('question-tag').textContent = (score + 1) + '번째 문제';
  byId('question').textContent = question.text;
  byId('gate-left').textContent = question.values[0];
  byId('gate-right').textContent = question.values[1];
  timeLimit.textContent = duration + '초';
  byId('announcement').textContent = question.text + '. 왼쪽 ' + question.values[0] + ', 오른쪽 ' + question.values[1] + '.';
  byId('course-text').textContent = '달리는 중';
  setState('running');
}

function startRun() {
  score = 0;
  travel = 0;
  runTime = 0;
  refreshScores();
  byId('finish').hidden = true;
  byId('start-text').textContent = '달리는 중';
  nextQuestion();
  scene.focus({ preventScroll: true });
}

function endRun(reason) {
  const focus = document.activeElement;
  setState('ended');
  byId('finish-title').textContent = reason;
  const summary = question.text + ' = ' + question.result + ' · 연속 정답 ' + score + '개';
  byId('finish-text').textContent = summary;
  byId('finish').hidden = false;
  byId('course-text').textContent = '달리기 종료';
  byId('start-text').textContent = '다시 달리기';
  byId('announcement').textContent = reason + '. ' + summary;
  if (focus === document.body || focus === scene || gates.includes(focus)) start.focus({ preventScroll: true });
}

function choose(index) {
  if (state !== 'running') return;

  selectedIndex = index;
  chosenProgress = elapsed / duration;
  feedback = 0;
  gates[index].classList.add('chosen');
  if (gates.includes(document.activeElement)) scene.focus({ preventScroll: true });
  setState('feedback');

  if (index !== question.correctIndex) {
    gates[index].classList.add('incorrect');
    byId('question-tag').textContent = '오답';
    return;
  }

  score += 1;
  if (score > best) {
    best = score;
    try { localStorage.setItem(bestKey, String(best)); } catch { /* Optional storage. */ }
  }

  refreshScores();
  byId('question-tag').textContent = '정답!';
  byId('announcement').textContent = '정답! 연속 ' + score + '개.';
}

function resize() {
  sceneWidth = scene.clientWidth;
  sceneHeight = scene.clientHeight;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(sceneWidth * pixelRatio);
  canvas.height = Math.round(sceneHeight * pixelRatio);
  road.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function paintRoad() {
  road.clearRect(0, 0, sceneWidth, sceneHeight);
  const horizon = sceneHeight * .40;
  for (let index = 0; index < 11; index += 1) {
    const distance = ((index / 11 + travel) % 1) ** 2.5;
    const y = horizon + distance * sceneHeight * .64;
    const spread = (sceneWidth * .47 + sceneHeight * .21) * distance;
    const length = 2 + 19 * distance;
    road.strokeStyle = 'rgba(222, 235, 180, ' + (.08 + distance * .48) + ')';
    road.lineWidth = 1 + distance * 1.8;
    for (const direction of [-1, 1]) {
      const x = sceneWidth / 2 + direction * spread;
      road.beginPath();
      road.moveTo(x, y);
      road.lineTo(x + direction * length, y + length * .8);
      road.stroke();
    }
  }

  // Ground reflections expand and spread as they pass beneath the runner.
  for (let index = 0; index < 24; index += 1) {
    const distance = ((index / 24 + travel) % 1) ** 2.65;
    const across = (index * .618) % 1 - .5;
    const x = sceneWidth / 2 + across * sceneWidth * distance;
    const y = horizon + distance * sceneHeight * .67;
    if (y > sceneHeight) continue;
    road.fillStyle = 'rgba(253, 224, 166, ' + (distance * .15) + ')';
    road.beginPath();
    road.ellipse(x, y, 2 + distance * 16, .4 + distance * 1.5, across * .25, 0, Math.PI * 2);
    road.fill();
  }
}

function paintRunner(motion) {
  const phase = motion ? runTime * 11 : 0;
  const frame = Math.floor(phase) % 6;
  const stride = Math.sin(phase * Math.PI / 3) ** 2 * -3;
  runner.style.setProperty('--stride', stride + 'px');
  if (frame === shownFrame) return;

  // The first three poses are mirrored to alternate the leading leg.
  runner.style.setProperty('--pose', (frame % 3) * -100 + '%');
  runner.style.setProperty('--facing', frame < 3 ? '1' : '-1');
  shownFrame = frame;
}

function gateOffset(position) {
  return Math.min(sceneWidth * (.10 + .135 * position), sceneHeight * .52);
}

function smoothstep(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

function paint() {
  let progress = .43;
  let steer = 0;
  let lean = 0;
  let gateOpacity = 1;
  if (state === 'running' || state === 'ended') progress = elapsed / duration;
  if (state === 'feedback') {
    const crossing = Math.min(1, feedback / crossingTime);
    const exit = Math.max(0, (feedback - crossingTime) / (returnEnd - crossingTime));
    progress = chosenProgress + (1 - chosenProgress) * crossing + .23 * exit;
    gateOpacity = 1 - smoothstep(exit);

    const direction = selectedIndex === 0 ? -1 : 1;
    const laneChange = smoothstep(feedback / (crossingTime * .85));
    const recenter = smoothstep((feedback - returnStart) / (returnEnd - returnStart));
    steer = direction * gateOffset(1) * laneChange * (1 - recenter);
    lean = direction * 10 * Math.sin(Math.PI * laneChange) * (1 - recenter);
  }
  const position = .16 + progress ** 1.5 * .84;
  const motion = !reducedMotion.matches;
  const remaining = Math.max(0, duration - elapsed);

  scene.style.setProperty('--remaining', remaining / duration);
  timer.classList.toggle('urgent', state === 'running' && remaining <= 2);
  if (state === 'running') {
    const seconds = Math.ceil(remaining) + '초';
    if (timeLimit.textContent !== seconds) timeLimit.textContent = seconds;
  }
  scene.style.setProperty('--depth', sceneHeight * (.11 + .47 * position) + 'px');
  scene.style.setProperty('--offset', gateOffset(Math.min(1, position)) + 'px');
  scene.style.setProperty('--gate-scale', .56 + .52 * position);
  scene.style.setProperty('--gate-opacity', gateOpacity);
  scene.style.setProperty('--question-drop', motion ? position * 8 + '%' : '0%');
  scene.style.setProperty('--question-scale', motion ? .92 + .22 * position : 1);
  scene.style.setProperty('--zoom', motion ? 1.024 + .016 * Math.sin(runTime * 1.15) : 1);
  runner.style.setProperty('--steer', steer + 'px');
  runner.style.setProperty('--lean', (motion ? lean : 0) + 'deg');

  if (motion) paintRoad();
  else road.clearRect(0, 0, sceneWidth, sceneHeight);

  paintRunner(motion);
}

function tick(time) {
  const step = lastFrame && !document.hidden ? (time - lastFrame) / 1000 : 0;
  lastFrame = time;

  if (state === 'running' || state === 'feedback') {
    const motionStep = Math.min(step, .05) * speeds[settings.speed].pace;
    runTime += motionStep;
    travel = (travel + motionStep * .46) % 1;
  }

  if (state === 'running') {
    elapsed = Math.min(duration, elapsed + step);
    if (elapsed >= duration) endRun('시간이 다 됐어요');
  } else if (state === 'feedback') {
    feedback += step;
    if (selectedIndex !== question.correctIndex && feedback >= crossingTime) endRun('오답이에요');
    else if (feedback >= returnEnd) nextQuestion();
  }

  paint();
  requestAnimationFrame(tick);
}

start.addEventListener('click', startRun);
openSettings.addEventListener('click', () => showSettings(true));
byId('cancel-settings').addEventListener('click', () => showSettings(false));
settingsForm.addEventListener('submit', saveSettings);
settingsForm.addEventListener('change', () => { settingsError.hidden = true; });
gates.forEach((button, index) => button.addEventListener('click', () => choose(index)));
window.addEventListener('keydown', event => {
  if (state !== 'running' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  if (!event.repeat) choose(event.key === 'ArrowLeft' ? 0 : 1);
});
document.addEventListener('visibilitychange', () => { lastFrame = 0; });
new ResizeObserver(resize).observe(scene);
refreshScores();
resize();
requestAnimationFrame(tick);
