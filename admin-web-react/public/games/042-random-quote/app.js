const generateQuoteBtn = document.getElementById("quoteBtn");
const quoteOutput = document.getElementById("quoteOutput");
const authorOutput = document.getElementById("authorOutput");

generateQuoteBtn.addEventListener("click", generateQuote);

// https://www.shopify.com/blog/motivational-quotes
const arrayOfQuotes = [
  {
    author: "Albert Einstein",
    quote:
      "Асуудлыг үүсгэсэн тэр л сэтгэлгээгээр түүнийг шийдэж чадахгүй",
  },
  {
    author: " Mark Twain",
    quote:
      "Таны хүсэл мөрөөдлийг басамжлах хүмүүсээс хол бай. Жижиг сэтгэлгээтэй хүмүүс үргэлж тэгдэг, харин агуу хүмүүс таныг ч агуу болж чадна гэдэгт итгүүлдэг.",
  },
  {
    author: "Eleanor",
    quote:
      "Бусдад баяр баясгалан бэлэглэхэд түүнээс илүүг буцааж авдаг. Бусдад өгч чадах аз жаргалынхаа талаар сайн бодож үзээрэй.",
  },
  {
    author: "Norman Vincent Peale",
    quote: "Бодлоо өөрчлөхдөө ертөнцөө ч өөрчлөхөө мартуузай.",
  },
  {
    author: "Walter",
    quote:
      "Эрсдэл хүлээж байж л амьдрал сайжирдаг. Бидний хамгийн эхний бөгөөд хамгийн хэцүү эрсдэл бол үнэнч байх явдал. ",
  },
  {
    author: "Diane McLaren",
    quote:
      "Байгаль бидэнд эрүүл, сайн сайхан амьдрах бүх хэсгийг өгсөн ч тэдгээрийг нийлүүлэхийг бидэнд даатгасан.",
  },
  {
    author: "Dale Carnegie",
    quote:
      "Бүтэлгүйтлээс амжилтыг бүтээ. Урам хугарал, бүтэлгүйтэл бол амжилтад хүрэх хамгийн найдвартай хоёр шат.",
  },
];

function generateQuote() {
  let random = Number.parseInt(Math.random() * arrayOfQuotes.length + 1);
  quoteOutput.innerHTML = `<span>${arrayOfQuotes[random].quote}</span>`;
  authorOutput.innerHTML = `<small>-${arrayOfQuotes[random].author}-</small>`;
}
