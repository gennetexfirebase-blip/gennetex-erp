let body = document.body;
let themer = document.querySelector(".themer");
const followButtons = document.querySelectorAll(".follow-button");

themer.addEventListener("click", toggleTheme);

function toggleTheme() {
  if (body.className === "light-theme") {
    body.className = "dark-theme";
    themer.innerText = "Гэгээлэг";
  } else {
    body.className = "light-theme";
    themer.innerText = "Харанхуй";
  }
}

followButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => followUnFollow(e.target));
});

function followUnFollow(button) {
  button.classList.toggle("followed");
  if (button.innerText == "Дагах") button.innerText = "Дагахаа болих";
  else button.innerText = "Дагах";
}
