// All texts, dates and file paths of the invitation live here — edit freely.
export const CONTENT = {
  couple: { bride: 'Аня', groom: 'Максим' },
  // Ceremony day; the countdown targets the guest gathering time (Moscow time, UTC+3).
  dateLabel: '01 · 07 · 2027',
  countdownTarget: '2027-07-01T15:00:00+03:00',

  intro: {
    defaultGreeting: 'Дорогой гость!',
    // {you} is replaced with "тебя" for one guest and "вас" for a couple / formal guest
    text: 'Мы рады пригласить {you} на наш праздник любви!',
    hint: 'Листайте вниз',
  },

  // Photos in museum frames on the clouds (portrait 3:4 works best). Drop files into public/assets/photos/.
  photos: [
    { src: 'assets/photos/placeholder-1.svg', alt: 'Аня' },
    { src: 'assets/photos/placeholder-2.svg', alt: 'Максим' },
  ],

  // Background music: the first format the browser can play is used (.ogg for most, .mp3 for older iPhones).
  music: ['assets/music/intermezzo.ogg', 'assets/music/intermezzo.mp3'],
  // Required by the recording's licence (EFF Open Audio License) — shown in the footer.
  musicCredit: 'Музыка: П. Масканьи — Интермеццо из оперы «Сельская честь». Fulda Symphonic Orchestra, дирижёр Simon Schindler (EFF Open Audio License)',

  // 3D column (.glb). Two ways to fit a model to the scene height:
  //  - `shaft`: name of the column-body mesh, stretched to the scene height (top and base keep proportions);
  //  - `stretchBand`: [from, to] fractions of the model height — only that band is stretched (single-mesh models).
  // Remove this block to go back to the built-in column.
  columnModel: {
    src: 'assets/models/stylized_pillar.opt.glb', // optimised copy (WebP textures, compact geometry); original kept next to it
    shaft: 'PillarMain',
    // Required by the model's licence (CC BY 4.0) — shown in the footer.
    credit: '3D-модель колонны: «Stylized Pillar», автор pixelated_stars (Sketchfab), CC BY 4.0',
  },
  // Alternative (photo-scanned ruin; its stretched shaft looks smeared close up):
  // columnModel: {
  //   src: 'assets/models/sagalassos_pillar.glb',
  //   stretchBand: [0.47, 0.65],
  //   credit: '3D-модель колонны: «Pillar on the agora of antic city of Sagalassos», автор Mikhail Volkov (Sketchfab), CC BY 4.0',
  // },

  // Detailed Colosseum in the distance (replaces the built-in one). Remove to go back.
  colosseumModel: {
    src: 'assets/models/colosseum_poly.glb',
    // Required by the model's licence (CC BY 4.0) — shown in the footer.
    credit: '3D-модель Колизея: «Coliseum from Poly by Google», автор IronEqual (Sketchfab), CC BY 4.0',
  },

  // Marble statue on its pedestal at the edge of the plaza.
  statueModel: {
    src: 'assets/models/venus_statue.opt.glb',
    height: 6.2, // world units, without the pedestal
    credit: '3D-модель статуи: «Polygonal Venus Statue - Low Poly», автор Enlil Scan (Sketchfab), CC BY 4.0',
  },

  // Sign floating above the top of the column, shown the moment the column comes into view.
  countdown: { type: 'countdown', label: 'До свадьбы', title: 'До свадьбы осталось' },

  // Grape-cluster tags along the vine, from top to bottom.
  stops: [
    {
      // Roman sundial on the column: the gnomon's shadow sweeps from mark to mark during one scroll
      type: 'schedule',
      photo: 'assets/photos/stop-schedule.jpg', // cameo hanging under the clock
      label: 'Программа',
      title: 'Программа дня',
      motto: 'AMOR VINCIT OMNIA',
      items: [
        { time: '15:00', roman: 'XV', title: 'Сбор гостей' },
        { time: '16:00', roman: 'XVI', title: 'Церемония' },
        { time: '17:00', roman: 'XVII', title: 'Банкет' },
        { time: '23:00', roman: 'XXIII', title: 'Завершение' },
      ],
    },
    {
      type: 'venue',
      photo: 'assets/photos/stop-venue.jpg', // photo pinned beside the signpost
      label: 'Место',
      title: 'Место торжества',
      text: 'Наша свадьба пройдёт в усадьбе Гребнево, банкетный зал «Лермонтов»',
      // texts carved on the signpost boards
      name: 'УСАДЬБА ГРЕБНЕВО',
      hall: 'банкетный зал «Лермонтов»',
      addressLine1: 'Московская обл., г.о. Щёлково',
      addressLine2: 'г. Фрязино, д. Гребнево',
      address: 'Московская обл., городской округ Щёлково, г. Фрязино, д. Гребнево',
      mapUrl: 'https://yandex.ru/maps/-/CXBWFUlS',
    },
    {
      type: 'dresscode',
      label: 'Дресс-код',
      title: 'Дресс-код',
      text: 'Дорогие гости, просим вас соблюсти цветовую гамму дресс-кода при выборе своего наряда',
      colors: ['#FAF8B0', '#66C26A', '#EF8C0C', '#8A6E62', '#E8CDB0', '#8A2E0A'],
      women: 'Вечерние платья длины миди и макси, рубашки, длинные юбки и брюки',
      men: 'Рубашки, поло, брюки, пиджаки',
      // Example looks shown in the gallery. Add your pictures to public/assets/dresscode/.
      womenImages: ['assets/dresscode/women-1.jpg', 'assets/dresscode/women-2.jpg'],
      menImages: ['assets/dresscode/men-1.jpg', 'assets/dresscode/men-2.jpg', 'assets/dresscode/men-3.jpg', 'assets/dresscode/men-4.jpg'],
    },
    {
      type: 'details',
      photo: 'assets/photos/stop-details.jpg', // polaroid taped to the chalkboard
      label: 'Детали',
      title: 'Детали',
      items: [
        'Мы будем рады любым вашим подаркам — как в конверте, так и творческим задумкам',
        'На свадьбе вас будут ждать сборы в ползунки и выкуп торта, поэтому просим вас иметь при себе наличные деньги',
        'Просим вас воздержаться от криков «Горько» во время торжества',
        'Если вы хотите подготовить для нас номер-сюрприз, просим предупредить об этом заранее нашего организатора Екатерину',
      ],
      // short versions for the chalkboard (icon: envelope | coins | hush | music)
      chalk: [
        { icon: 'envelope', text: 'Подарки — мы будем рады любым подаркам от вас, как в конверте, так и творческим задумкам' },
        { icon: 'coins', text: 'Наличные — просим вас иметь при себе наличку, на сборы в ползунки и выкуп торта' },
        { icon: 'hush', text: '«Горько» — пожалуйста, воздержитесь от криков «Горько» во время торжества' },
        { icon: 'music', text: 'Номер-сюрприз от гостей? Предупредите организатора' },
      ],
      organizer: { name: 'Екатерина', phone: '+7 916 884 4012', telegram: 'kathrinkushnir' },
    },
  ],

  rsvp: {
    title: 'Анкета гостя',
    subtitle: 'Ваши ответы на вопросы очень помогут нам в организации торжества',
    deadline: 'Ждём ваши ответы до 01 мая 2027',
    drinks: ['Шампанское', 'Вино красное', 'Вино белое', 'Водка', 'Виски', 'Коньяк', 'Что-то безалкогольное'],
    thanks: 'Ваши ответы сохранены. Если что-то изменится — просто отправьте анкету ещё раз.',
  },
};
