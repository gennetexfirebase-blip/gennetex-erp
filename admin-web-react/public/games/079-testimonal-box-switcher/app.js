const testimonialsContainer = document.querySelector(".testimonial-container");
const testimonial = document.querySelector(".testimonial");
const userImage = document.querySelector(".user-avater");
const username = document.querySelector(".username");
const twitterHandle = document.querySelector(".twitter-handle");

const testimonials = [
  {
    name: "Guillermo Rauch",
    position: "@rauchg",
    photo:
      "https://pbs.twimg.com/profile_images/1450115233205272576/CFTTK-0I_400x400.jpg",
    text: "Өнөөдөр програмчлалд орох арга зөвлөх бол HTML + CSS-ийг @tailwindcss-тэй хамт гэж хэлнэ. Үр өгөөж нь гайхалтай. Энэ responsive жишээ ердөө ~21 өөрийн CSS шинжтэй, бусад нь Tailwind-ийн класс ба энгийн HTML.",
  },
  {
    name: "Dacey Nolan",
    position: "@dacey_nolan",
    photo:
      "https://pbs.twimg.com/profile_images/1356685491127656449/db8jKmuZ_400x400.jpg",
    text: "Би @tailwindcss ашиглаж эхэлсэн. Responsive тохиргоо, нарийн баримт бичиг, өнгөний палитрыг хялбар тохируулдагт нь шууд дурласан.",
  },
  {
    name: "Sarah Dayan",
    position: "@frontstuff_io",
    photo:
      "https://pbs.twimg.com/profile_images/977873484759158784/mOItIR7M_400x400.jpg",
    text: "Tailwind CSS нь дизайн систем ба бүтээгдэхүүний хоорондох зайг холбож байна. Загварчлалын бодит стандарт болж байна.",
  },
  {
    name: "Igor Randjelovic",
    position: "@igor_randj",
    photo:
      "https://pbs.twimg.com/profile_images/970109919444824064/X0XU8ZD9_400x400.jpg",
    text: "Tailwind надад бараг шууд ойлгогдсон. Дахиж BEM класс бичнэ гэж төсөөлөхгүй байна. Анхны хувилбараас хойш сэтгэл хангалуун хэрэглэгч! @tailwindcss-ийн ачаар бүтээмж маань дээд цэгтээ.",
  },
  {
    name: "Dan Malone",
    position: "@ohhdanm",
    photo:
      "https://pbs.twimg.com/profile_images/1523786296308736000/aJ7nC2LN_400x400.jpg",
    text: "CSS үргэлж цахим үйлчилгээ хийхэд хамгийн хэцүү хэсэг байсан бөгөөд намайг муу хөгжүүлэгч мэт мэдрүүлдэг байв. Tailwind надад вэб хөгжүүлэлтэд дахин итгэл өгсөн. Тэдний баримт бичгээс би хамгийн түрүүнд хайдаг.",
  },
  {
    name: "Sergio Peris",
    position: "@sertxudev",
    photo:
      "https://pbs.twimg.com/profile_images/1526657447326371842/vtmVANH7_400x400.jpg",
    text: "Би 'CSS мэддэг, Bootstrap ашигладаг байхад Tailwind CSS яах юм бэ?' гэж боддог байлаа. Гэвч туршаад үзсэнийхээ дараа бүх төслөө Tailwind руу шилжүүлэхээр шийдсэн.",
  },
  {
    name: "marckohlbrugge.eth",
    position: "@marckohlbrugge",
    photo:
      "https://pbs.twimg.com/profile_images/1517414077534191616/fUc3KRh6_400x400.jpg",
    text: "Tailwind CSS-ээс өмнө би орооцолдсон CSS-ээ ойлгох гэж толгойгоо хананд цохидог байлаа. Одоо яагаад эрт туршаагүй юм бол гэж толгойгоо хананд цохиж байна. Толгой минь өвдөж, хана маань цоорсон ч ядаж CSS ашиглах дахин таатай боллоо!",
  },
];

let counter = 1;

function showNextTestimonial() {
  const { name, position, photo, text } = testimonials[counter];

  testimonial.innerHTML = text;
  userImage.src = photo;
  username.innerHTML = name;
  twitterHandle.innerHTML = position;

  counter++;

  if (counter > testimonials.length - 1) {
    counter = 0;
  }
}

setInterval(showNextTestimonial, 10000);
