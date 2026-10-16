const username = document.querySelector(".username");
const email = document.querySelector(".email");
const password1 = document.querySelector(".password1");
const password2 = document.querySelector(".password2");
const submit = document.querySelector(".submit");

// MESSAGES
const usernameMessage = document.querySelector(".user-msg");
const emailMessage = document.querySelector(".email-msg");
const password1Message = document.querySelector(".password1-msg");
const password2Message = document.querySelector(".password2-msg");

submit.addEventListener("click", (e) => {
  e.preventDefault();

  if (username === "" && email === "" && password1 === "" && password2 === "") {
    alert("Бүх талбарыг бөглөнө үү");
  }

  if (username.value === "") {
    showMessage(usernameMessage, "Нэрээ оруулна уу", "#FF0000");
  } else {
    showMessage(usernameMessage, "Сайхан нэр", "#4BB543");
  }

  if (email.value === "") {
    showMessage(emailMessage, "Имэйлээ оруулна уу", "#FF0000");
  } else {
    showMessage(emailMessage, "Имэйл зөв байна", "#4BB543");
  }

  if (password1.value === "") {
    showMessage(password1Message, "Нууц үгээ оруулна уу", "#FF0000");
  } else {
    showMessage(password1Message, "Нууц үг зөв", "#4BB543");
  }

  if (password2.value === "") {
    showMessage(password2Message, "Нууц үгээ давтана уу", "#FF0000");
  } else if (password1.value !== password2.value) {
    showMessage(password2Message, "Нууц үг таарахгүй байна", "#FF0000");
  } else {
    showMessage(password2Message, "Нууц үг зөв", "#4BB543");
  }
});

function showMessage(element, msg, color) {
  element.style.visibility = "visible";
  element.textContent = msg;
  element.style.color = color;
  element.previousElementSibling.style.border = `2px solid ${color}`;
}
