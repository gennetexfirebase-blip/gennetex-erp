const main = document.querySelector(".main");
const typeArea = document.querySelector(".typingArea");
const btn = document.querySelector(".btn");

const words = [
  "Програмистын нэг өдөр",
  "JavaScript гэж юу вэ?",
  "React гэж юу вэ?",
  "Програмчлалын хэл гэж юу вэ?",
  "Таны нэр хэн бэ?",
  "Та хаанаас ирсэн бэ?",
  "Энэ бол зүгээр л санамсаргүй үг",
  "Remix.js гэж юу вэ?",
  "Шинэ технологи",
  "Програмчлал хэцүү юу?",
  "Та яагаад програмист болохыг хүсэж байна вэ?",
  "Аль програмчлалын хэлэнд хамгийн их дуртай вэ?",
  "Golang гэж юу вэ? Яагаад сурахыг хүсэж байна?",
  "CSS гэж юу вэ",
];

const game = {
  start: 0,
  end: 0,
  user: "",
  arrText: "",
};

btn.addEventListener("click", () => {
  if (btn.textContent === "Эхлэх") {
    play();
    typeArea.value = "";
    typeArea.disabled = false;
  } else if (btn.textContent === "Дууслаа") {
    typeArea.disabled = true;
    main.style.borderColor = "white";
    end();
  }
});

function play() {
  let randText = Math.floor(Math.random() * words.length);
  main.textContent = words[randText];
  game.arrText = words[randText];
  main.style.borderColor = "#c8c8c8";
  btn.textContent = "Дууслаа";
  const duration = new Date();
  game.start = duration.getTime(); // unix timestamp
}

function end() {
  const duration = new Date();
  game.end = duration.getTime();
  const totalTime = (game.end - game.start) / 1000;
  game.user = typeArea.value;
  const correct = results();
  main.style.borderColor = "white";
  main.innerHTML = `Хугацаа: ${totalTime} Оноо: ${correct.total}-аас ${correct.score}`;
  btn.textContent = "Эхлэх";
}

function results() {
  let valueOne = game.arrText.split(" ");
  let valueTwo = game.user.split(" ");
  let score = 0;
  valueOne.forEach((word, idx) => {
    if (word === valueTwo[idx]) {
      score++;
    }
  });

  return { score, total: valueOne.length };
}
