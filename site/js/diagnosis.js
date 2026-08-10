
/* Questions are external data so editors can change wording without touching the logic. */
const CHOICE_LABELS = [
  "そう思わない",
  "どちらかと言えばそう思わない",
  "どちらでもない",
  "どちらかと言えばそう思う",
  "そう思う",
];
const CHOICE_SCORES = [-2, -1, 0, 1, 2];
const DIAGNOSIS_DATA_VERSION = "20260811-five-point";

let questions = [];
let index = 0;
const answers = [];
const $ = (id) => document.getElementById(id);

fetch(`data/questions.json?v=${DIAGNOSIS_DATA_VERSION}`)
  .then((response) => response.json())
  .then((data) => {
    questions = data;
    render();
  })
  .catch(() => {
    $("question-text").textContent = "質問データを読み込めませんでした。";
  });

function render() {
  const question = questions[index];
  const selected = answers[index];
  $("question-number").textContent = `Q ${index + 1} / ${questions.length}`;
  $("question-category").textContent = question.category;
  $("question-text").textContent = question.text;
  $("progress-bar").style.width = `${(index / questions.length) * 100}%`;
  $("back-button").disabled = index === 0;
  $("next-button").disabled = selected === undefined;
  $("next-button").textContent = index === questions.length - 1 ? "診断結果を見る →" : "次へ →";
  $("choices").innerHTML = CHOICE_LABELS.map((label, choiceIndex) => `
    <button class="choice ${selected === choiceIndex ? "selected" : ""}" type="button" data-index="${choiceIndex}">${label}</button>
  `).join("");
  document.querySelectorAll(".choice").forEach((button) => {
    button.onclick = () => {
      answers[index] = Number(button.dataset.index);
      window.Analytics?.answer(answers.filter((value) => value !== undefined).length);
      render();
    };
  });
}

$("back-button").onclick = () => {
  if (index) {
    index -= 1;
    render();
  }
};

$("next-button").onclick = () => {
  if (index < questions.length - 1) {
    index += 1;
    render();
    return;
  }

  const score = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  questions.forEach((question, questionIndex) => {
    const value = CHOICE_SCORES[answers[questionIndex]];
    if (value === 0) return;
    const positive = question.positive;
    const opposite = question.axis.replace(positive, "");
    score[value > 0 ? positive : opposite] += Math.abs(value);
  });
  const type = (score.E >= score.I ? "E" : "I")
    + (score.S >= score.N ? "S" : "N")
    + (score.T >= score.F ? "T" : "F")
    + (score.J >= score.P ? "J" : "P");
  window.Analytics?.complete(type);
  Storage.save({ type, score, completedAt: new Date().toISOString() });
  location.href = "result.html";
};

