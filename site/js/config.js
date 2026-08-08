/*
 * The fallback destination for every result page.
 * Add a specific article URL to NOTE_URLS later when an article is published.
 */
const CONFIG = {
  NOTE_URL: "https://note.com/mbti_noter",
  NOTE_URLS: {
    ENFP: "https://note.com/mbti_noter/n/nb45dd9f4887b",
    ENFJ: "https://note.com/mbti_noter/n/n7cf0d46bb004",
    ENTP: "https://note.com/mbti_noter/n/n902959f2a6b8",
    ENTJ: "https://note.com/mbti_noter/n/n7a15fc6261a3",
    ESFP: "https://note.com/mbti_noter/n/nfa3f4806f053",
    ESFJ: "https://note.com/mbti_noter/n/ncb29fae7674a",
    ESTP: "https://note.com/mbti_noter/n/n2660b7c3581b",
    ESTJ: "https://note.com/mbti_noter/n/n9195fd645c81",
    INFP: "https://note.com/mbti_noter/n/nd9c991b4d7c3",
    INFJ: "https://note.com/mbti_noter/n/n89022d2ba84c",
    INTP: "https://note.com/mbti_noter/n/n65dd038ce190",
    INTJ: "https://note.com/mbti_noter/n/n0cebffd80fd3",
    ISFP: "https://note.com/mbti_noter/n/n096af3f8b9ae",
    ISFJ: "https://note.com/mbti_noter/n/n2afc5de6dc83",
    ISTP: "https://note.com/mbti_noter/n/nd8cb80d194b8",
    ISTJ: "https://note.com/mbti_noter/n/nf429447fac00"
  }
};

const MBTI_TYPE_NAMES = {
  ENFP: "自由すぎる愛されクリエイタータイプ", ENFJ: "人を惹きつける情熱リーダータイプ",
  ENTP: "口がうまいひらめき革命家タイプ", ENTJ: "勝ち筋を見抜くカリスマ指揮官タイプ",
  ESFP: "みんなの太陽ムードメーカータイプ", ESFJ: "気配り上手な愛され世話焼きタイプ",
  ESTP: "行動力バグりのリアル起業家タイプ", ESTJ: "頼られすぎる現実派キャプテンタイプ",
  INFP: "自由な心の仲介者タイプ", INFJ: "理想を描くカウンセラータイプ",
  INTP: "知的な探求者タイプ", INTJ: "戦略的な建築家タイプ",
  ISFP: "感性豊かな冒険家タイプ", ISFJ: "献身的なサポータータイプ",
  ISTP: "クールな職人タイプ", ISTJ: "信頼される誠実な縁の下の力持ちタイプ"
};

/* Cover images from each corresponding note article. */
const NOTE_IMAGE_URLS = {
  ENFP: "img/type-covers/ENFP.jpeg",
  ENFJ: "img/type-covers/ENFJ.jpeg",
  ENTP: "img/type-covers/ENTP.jpeg",
  ENTJ: "img/type-covers/ENTJ.png",
  ESFP: "img/type-covers/ESFP.jpeg",
  ESFJ: "img/type-covers/ESFJ.png",
  ESTP: "img/type-covers/ESTP.jpeg",
  ESTJ: "img/type-covers/ESTJ.jpeg",
  INFP: "img/type-covers/INFP.jpeg",
  INFJ: "img/type-covers/INFJ.jpeg",
  INTP: "img/type-covers/INTP.jpeg",
  INTJ: "img/type-covers/INTJ.jpeg",
  ISFP: "img/type-covers/ISFP.jpeg",
  ISFJ: "img/type-covers/ISFJ.jpeg",
  ISTP: "img/type-covers/ISTP.jpeg",
  ISTJ: "img/type-covers/ISTJ.jpeg"
};

const resultHero = document.getElementById("result-hero");
const heroObserver = new MutationObserver(() => {
  const saved = JSON.parse(localStorage.getItem("sixteenTypeDiagnosis") || "null");
  const displayType = new URLSearchParams(location.search).get("preview") || saved?.type;
  const imageUrl = NOTE_IMAGE_URLS[displayType];
  if (!imageUrl || resultHero.querySelector(".result-hero-image")) return;
  heroObserver.disconnect();
  const image = document.createElement("img");
  image.className = "result-hero-image";
  image.src = imageUrl;
  image.alt = `${displayType}タイプのnote記事画像`;
  resultHero.prepend(image);
});
heroObserver.observe(resultHero, { childList: true });

/* Compatibility labels use the MBTI code only, without the trailing word "タイプ". */
const bestMatchList = document.getElementById("best-match");
const bestMatchObserver = new MutationObserver(() => {
  if (!bestMatchList.children.length) return;
  [...bestMatchList.children].forEach((item) => {
    item.textContent = item.textContent.replace(/タイプ$/, "");
  });
  bestMatchObserver.disconnect();
});
bestMatchObserver.observe(bestMatchList, { childList: true });
