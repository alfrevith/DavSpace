// Edit each project independently here. Keep its key equal to the card's data-project.
// Empty strings/arrays display a neutral placeholder. All visitor-facing text is English.
// accent: a six-digit hex color for this project's neon lighting, e.g. "#93e7ff".
// logo: a PNG/WebP/SVG path from the site root, or "images/icons" to leave the title without a logo.
// logoWhiteBackground: true adds a soft white glow behind this project's menu logo.
// logoDoubleSize: true doubles this project's menu logo size (also on mobile).
// status: "in-development" | "prototype" | "completed" | ""
// mode: "individual" | "team" | ""
// pdf: a local path such as "pdfs/beyond.pdf", or an HTTPS PDF URL that allows embedding.
window.PORTFOLIO_PROJECTS = {
  beyond: {
    title: "Beyond",
    logoDoubleSize: false,
    logo: "images/icons/beyond.png",
    logoWhiteBackground: false,
    accent: "#E8B566",
    status: "completed",
    role: "Frontend / Backend",
    type: ["Web"],
    date: "2026",
    mode: "individual",
    technologies: ["HTML", "CSS", "JavaScript"],
    description: "Beyond is an educational platform I created to help students prepare for the AVANZO 2026 exam in El Salvador. It started as a personal project during my final year of high school, inspired by my own experience preparing for the exam and realizing how challenging it can be to study so many different subjects at once. I wanted to use my programming skills to create something that could make a difference, not just for myself, but for other students going through the same experience. That's how Beyond came to life: a free and accessible platform where students can practice with interactive exams, test their knowledge, identify their weaknesses, and learn from their mistakes through detailed explanations. My goal was never just to help students get better grades, but to make learning feel more approachable and encourage them to believe in their own abilities. Beyond represents my passion for technology and my belief that even a simple idea can become something meaningful when it's created with the intention of helping others.",
    pdf: "pdfs/Beyond.pdf"
  },
  "plant-bud": {
    title: "Plant Bud",
    logoDoubleSize: false,
    logo: "images/icons/plant-bud.png",
    logoWhiteBackground: false,
    accent: "#a7f3c5",
    status: "",
    role: "Frontend / Backend",
    type: ["Web", "PWA"],
    date: "2026",
    mode: "",
    technologies: ["HTML", "CSS", "JavaScript", "Node.js", "AdonisJS", "Python"],
    description: "",
    pdf: ""
  },
  "pot-c": {
    title: "POT-C",
    logoDoubleSize: false,
    logo: "images/icons/POT-C.png",
    logoWhiteBackground: false,
    accent: "#03fc13",
    status: "",
    role: "",
    type: ["Informative Web", "Smart Bin"],
    date: "2025",
    mode: "",
    technologies: [],
    description: "",
    pdf: ""
  },
  cecam: {
    title: "CECAM",
    logoDoubleSize: false,
    logo: "",
    logoWhiteBackground: false,
    accent: "#0800f2",
    status: "prototype",
    role: "",
    type: ["Web", "Prototype"],
    date: "2025",
    mode: "",
    technologies: [],
    description: "",
    pdf: ""
  },
  "pets-health": {
    title: "Pet's Health",
    logoDoubleSize: true,
    logo: "images/icons/pets-health.png",
    logoWhiteBackground: true,
    accent: "#EDDAAC",
    status: "prototype",
    role: "",
    type: ["Mobile App", "Prototype"],
    date: "2024",
    mode: "",
    technologies: [],
    description: "",
    pdf: ""
  }
};
