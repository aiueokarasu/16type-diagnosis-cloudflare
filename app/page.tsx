"use client";

import { useMemo, useState } from "react";

type Axis = "EI" | "SN" | "TF" | "JP";
type Answer = Record<Axis, number>;

const questions: { axis: Axis; text: string; left: string; right: string }[] = [
  { axis: "EI", text: "新しい人が集まる場では", left: "自分から話しかける", right: "様子を見てから話す" },
  { axis: "SN", text: "説明を聞くとき惹かれるのは", left: "具体例や事実", right: "全体像や可能性" },
  { axis: "TF", text: "難しい判断で優先するのは", left: "筋が通っていること", right: "関係者が納得できること" },
  { axis: "JP", text: "休日の予定は", left: "前もって決めたい", right: "その日の気分で決めたい" },
  { axis: "EI", text: "考えを整理しやすいのは", left: "誰かと話しているとき", right: "ひとりで考えているとき" },
  { axis: "SN", text: "仕事で信頼するのは", left: "実績のある方法", right: "まだ試されていない発想" },
  { axis: "TF", text: "意見が割れたとき、まず見るのは", left: "基準と根拠", right: "気持ちと背景" },
  { axis: "JP", text: "締切のある作業は", left: "早めに道筋を固める", right: "最後まで選択肢を残す" },
  { axis: "EI", text: "長い一日のあと回復するのは", left: "人と過ごす時間", right: "静かな自分の時間" },
  { axis: "SN", text: "会話で自然に注目するのは", left: "今起きていること", right: "その先に起こりそうなこと" },
  { axis: "TF", text: "フィードバックを伝えるなら", left: "率直で明確に", right: "受け取り方に配慮して" },
  { axis: "JP", text: "旅行で心地よいのは", left: "予約済みの安心感", right: "寄り道できる自由さ" },
  { axis: "EI", text: "アイデアが浮かぶのは", left: "刺激のある環境", right: "集中できる静かな環境" },
  { axis: "SN", text: "新しい企画では", left: "実現方法から考える", right: "理想の姿から考える" },
  { axis: "TF", text: "ルールに例外を作るなら", left: "一貫性を慎重に検討する", right: "個別事情を柔軟に考える" },
  { axis: "JP", text: "机やファイルの状態は", left: "整理されていると落ち着く", right: "必要なものが見つかれば十分" },
];

const typeInfo: Record<string, { name: string; tagline: string; color: string; strengths: string[]; note: string }> = {
  INTJ: { name: "戦略を描く設計者", tagline: "静かに先を読み、複雑な課題を構造に変える人。", color: "#7658d6", strengths: ["長期的な視点", "独立した思考", "仕組み化"], note: "考えが完成する前でも、小さく共有すると協力者を得やすくなります。" },
  INTP: { name: "問いを深める探究者", tagline: "常識をほどき、まだない答えを組み立てる人。", color: "#7658d6", strengths: ["論理的な分析", "発想の柔軟さ", "知的好奇心"], note: "検討の期限を決めると、洞察を行動へつなげやすくなります。" },
  ENTJ: { name: "未来を動かす指揮者", tagline: "目標を定め、人と資源を前へ進める人。", color: "#7658d6", strengths: ["決断力", "戦略性", "推進力"], note: "結論の前に相手の背景を尋ねると、チームの力をさらに引き出せます。" },
  ENTP: { name: "可能性を拓く発明家", tagline: "新しい角度から、停滞を面白い挑戦に変える人。", color: "#7658d6", strengths: ["機転", "創造性", "議論力"], note: "最も大切な一案を選び、完了まで磨く時間を確保しましょう。" },
  INFJ: { name: "意味を照らす伴走者", tagline: "人の奥にある願いを見つけ、静かに道を示す人。", color: "#2f9d75", strengths: ["洞察力", "共感性", "ビジョン"], note: "すべてを背負わず、自分の境界線も大切にすると持続力が増します。" },
  INFP: { name: "価値を守る物語家", tagline: "自分らしい価値観から、やさしい可能性を育てる人。", color: "#2f9d75", strengths: ["想像力", "誠実さ", "共感力"], note: "理想への最初の一歩を、今日できる小さな行動にしてみましょう。" },
  ENFJ: { name: "成長を導く共創者", tagline: "人の可能性を信じ、輪の力をひとつにする人。", color: "#2f9d75", strengths: ["対人理解", "鼓舞する力", "調整力"], note: "周囲の期待だけでなく、自分が本当に望むことにも席を用意しましょう。" },
  ENFP: { name: "心をひらく冒険家", tagline: "好奇心と熱意で、人とアイデアを結びつける人。", color: "#2f9d75", strengths: ["熱意", "柔軟性", "つながる力"], note: "新鮮さが薄れた後の仕上げを習慣化すると、魅力が成果になります。" },
  ISTJ: { name: "信頼を積む実務家", tagline: "約束と事実を大切に、着実な土台をつくる人。", color: "#3186a0", strengths: ["責任感", "正確さ", "継続力"], note: "変化の理由を確かめたうえで試すと、強い基盤に新しい選択肢が加わります。" },
  ISFJ: { name: "日常を支える守り手", tagline: "細やかな気づきで、人が安心できる場所をつくる人。", color: "#3186a0", strengths: ["気配り", "実行力", "忠実さ"], note: "助けを求めることも、周囲への信頼を示す大切な行動です。" },
  ESTJ: { name: "秩序をつくる実行者", tagline: "基準を明確にし、チームを確かな結果へ導く人。", color: "#3186a0", strengths: ["組織力", "現実感覚", "責任感"], note: "効率だけでなく納得のプロセスにも目を向けると、より強い協力が生まれます。" },
  ESFJ: { name: "輪を育てる世話役", tagline: "温かな働きかけで、みんなの居場所を整える人。", color: "#3186a0", strengths: ["協調性", "実務力", "観察力"], note: "全員に好かれることより、自分の価値観に沿う選択を大切にしましょう。" },
  ISTP: { name: "静かな問題解決者", tagline: "状況を冷静に読み、最短の一手を見つける人。", color: "#d79a26", strengths: ["適応力", "観察眼", "実践的な分析"], note: "考えていることを少し言葉にすると、周囲と強みを共有できます。" },
  ISFP: { name: "感性で彩る職人", tagline: "今この瞬間を大切に、自然体の美しさを生む人。", color: "#d79a26", strengths: ["感受性", "柔軟さ", "穏やかな行動力"], note: "大切な希望は控えめにせず、具体的な言葉で伝えてみましょう。" },
  ESTP: { name: "瞬間をつかむ挑戦者", tagline: "現場の変化を味方に、機敏に道を切り拓く人。", color: "#d79a26", strengths: ["行動力", "現実対応力", "社交性"], note: "次の刺激へ向かう前に、今回の経験から得たものを振り返ると成長が残ります。" },
  ESFP: { name: "場を輝かせる表現者", tagline: "明るい存在感と優しさで、今を特別にする人。", color: "#d79a26", strengths: ["親しみやすさ", "感性", "即応力"], note: "未来の自分が喜ぶ、小さな準備も楽しみの一部にしてみましょう。" },
};

const initial: Answer = { EI: 0, SN: 0, TF: 0, JP: 0 };

export default function Home() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Answer>(initial);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const q = questions[index];

  const percentages = useMemo(() => {
    const count = questions.filter((item) => item.axis === "EI").length;
    return (Object.keys(initial) as Axis[]).map((axis) => ({ axis, left: Math.round(((scores[axis] + count) / (count * 2)) * 100) }));
  }, [scores]);

  function answer(value: number) {
    const next = { ...scores, [q.axis]: scores[q.axis] + value };
    setScores(next);
    if (index < questions.length - 1) return setIndex(index + 1);
    setResult(`${next.EI >= 0 ? "E" : "I"}${next.SN >= 0 ? "S" : "N"}${next.TF >= 0 ? "T" : "F"}${next.JP >= 0 ? "J" : "P"}`);
  }

  function reset() { setStarted(false); setIndex(0); setScores(initial); setResult(null); setCopied(false); }

  if (result) {
    const info = typeInfo[result];
    return <main className="result-shell" style={{ "--accent": info.color } as React.CSSProperties}>
      <nav className="nav"><button className="brand" onClick={reset}><span>16</span> compass</button><button className="quiet" onClick={reset}>もう一度診断</button></nav>
      <section className="result-card">
        <p className="eyebrow">YOUR TYPE</p><div className="type-code">{result}</div>
        <h1>{info.name}</h1><p className="tagline">{info.tagline}</p>
        <div className="strengths">{info.strengths.map((s) => <span key={s}>{s}</span>)}</div>
        <div className="axis-list">
          {percentages.map(({ axis, left }) => <div className="axis-row" key={axis}><span>{axis[0]}</span><div><i style={{ width: `${left}%` }} /></div><span>{axis[1]}</span><b>{left >= 50 ? left : 100-left}%</b></div>)}
        </div>
        <div className="growth"><small>GROWTH NOTE</small><p>{info.note}</p></div>
        <div className="result-actions"><button className="primary" onClick={() => { navigator.clipboard?.writeText(`私の16タイプは ${result}「${info.name}」でした。`); setCopied(true); }}>{copied ? "コピーしました" : "結果をコピー"}</button><button className="secondary" onClick={reset}>最初から</button></div>
        <p className="disclaimer">この診断は自己理解を楽しむための簡易コンテンツです。医学的・心理学的な診断ではありません。</p>
      </section>
    </main>;
  }

  if (started) return <main className="quiz-shell">
    <nav className="nav"><button className="brand" onClick={reset}><span>16</span> compass</button><p>{index + 1} / {questions.length}</p></nav>
    <div className="progress"><i style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <section className="question-card"><p className="eyebrow">QUESTION {String(index + 1).padStart(2, "0")}</p><h1>{q.text}</h1><div className="choices"><button onClick={() => answer(1)}><b>A</b><span>{q.left}</span></button><div className="or">OR</div><button onClick={() => answer(-1)}><b>B</b><span>{q.right}</span></button></div><p className="hint">直感に近いほうを選んでください</p></section>
  </main>;

  return <main className="home-shell">
    <nav className="nav"><div className="brand"><span>16</span> compass</div><p>約3分 ・ 16問</p></nav>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">A SMALL COMPASS FOR YOURSELF</p><h1>自分らしさの<br />輪郭を、<em>16タイプ</em>で。</h1><p className="lead">正解を探すのではなく、いつもの選び方を見つめる16の質問。今のあなたを映す、小さなコンパスです。</p><button className="primary start" onClick={() => setStarted(true)}>診断をはじめる <span>→</span></button><p className="privacy">登録不要・回答データは保存されません</p></div><div className="orbit" aria-hidden="true"><div className="ring ring-one"/><div className="ring ring-two"/><div className="center">YOU<span>?</span></div>{["E","I","N","S","T","F","J","P"].map((x,i)=><i key={x} style={{"--i":i} as React.CSSProperties}>{x}</i>)}</div></section>
    <section className="features"><article><b>01</b><h2>迷わず答える</h2><p>どちらが普段の自分に近いか、直感で選ぶだけ。</p></article><article><b>02</b><h2>4つの軸で知る</h2><p>エネルギー、ものの見方、判断、行動スタイルを整理。</p></article><article><b>03</b><h2>日常に持ち帰る</h2><p>強みと成長のヒントを、わかりやすい言葉でお届け。</p></article></section>
    <footer>© 2026 16 compass <span>自己理解のための簡易診断</span></footer>
  </main>;
}
