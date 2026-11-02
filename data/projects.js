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
    description: "Beyond is an educational platform I created during my final year of high school to help students prepare for the AVANZO 2026 exam in El Salvador. It was born from my own experience of studying for the exam and realizing how overwhelming it could be to prepare for so many subjects at once. I wanted to use my programming skills to turn that challenge into something useful for others.\n\nThe platform offers free, interactive practice across Mathematics, Language and Literature, Natural Sciences, and Social Studies. Students can take 20-question timed exams with a 60-minute limit or complete more extensive 100-question diagnostic assessments. Beyond also provides immediate feedback, detailed explanations for incorrect answers, and results that help students identify their strengths and weaknesses, making it easier to understand what they need to improve.\n\nBeyond represents more than just an exam preparation tool. My goal was never simply to help students achieve better grades, but to make learning more accessible, independent, and meaningful. Inspired by the idea of going beyond our own limits, this project reflects my passion for technology and my belief that even a simple idea can make a difference when it's created to help others grow.",
    pdf: "pdfs/Beyond.pdf"
  },
  "plant-bud": {
    title: "Plant Bud",
    logoDoubleSize: false,
    logo: "images/icons/plant-bud.png",
    logoWhiteBackground: false,
    accent: "#a7f3c5",
    status: "completed",
    role: "Frontend / Backend",
    type: ["Web", "PWA"],
    date: "2026",
    mode: "team",
    technologies: ["HTML", "CSS", "JavaScript", "Node.js", "AdonisJS", "Python"],
    description: "Plant Bud is a web application I helped develop in 2026 alongside a team from ¡Supérate! Fundación Poma, designed to make plant care easier, smarter, and more accessible through technology. The project was born from the idea of helping people take better care of their plants, even without previous gardening experience, while also connecting them with local gardening professionals and businesses.\n\nOne of Plant Bud's main features is its integration of artificial intelligence, allowing users to analyze their plants' health through photos, identify potential problems, and receive personalized care recommendations alongside useful information about each plant. This feature aims to make plant care less confusing by helping users better understand what their plants need, whether it's proper watering, sunlight, or general maintenance.\n\nThe platform also includes an AI-powered garden design tool that allows users to upload a picture of their garden, experiment with different ideas, and visualize ways to improve or personalize their outdoor spaces. Beyond these tools, Plant Bud connects users with professional gardeners they can hire and helps them discover nearby nurseries. It also features a reward points system for payments made through the platform, creating additional benefits for users while supporting local gardening businesses.\n\nPlant Bud represents our belief that technology can bring people closer to nature while solving everyday problems in creative ways. Developing it gave me the opportunity to work on both front-end and back-end development, collaborate with a team, and explore practical applications of artificial intelligence. We also had the opportunity to represent ¡Supérate! Fundación Poma at Expo Tech, where we presented our project and its purpose. As one of my most ambitious projects, Plant Bud helped me grow as a developer and showed me how an idea can evolve into a platform that combines innovation, environmental awareness, and real-world usefulness.",
    pdf: "pdfs/plant-bud.pdf"
  },
  "pot-c": {
    title: "POT-C",
    logoDoubleSize: false,
    logo: "images/icons/POT-C.png",
    logoWhiteBackground: false,
    accent: "#03fc13",
    status: "prototype",
    role: "Frontend / 3D Printers / Hardware",
    type: ["Informative Web", "Smart Bin"],
    date: "2025",
    mode: "team",
    technologies: ["HTML", "CSS", "JavaScript", "Arduino"],
    description: "POT-C is an environmental technology project I developed alongside my team at ¡Supérate! Fundación Poma in 2025, with the goal of finding a more sustainable way to manage organic household waste. At the center of the project was Klani, a smart compost bin designed to transform everyday organic waste, such as fruit peels, vegetable scraps, and eggshells, into natural compost. The system was designed to work through five different phases, aiming to make the composting process faster, more efficient, and easier to manage while reducing unpleasant odors and promoting environmentally friendly habits.\n\nMy main responsibility was developing the front end of POT-C's informational website, using HTML, Tailwind CSS, and JavaScript to create an interactive and visually engaging experience. The website included detailed explanations of the composting process, environmental benefits, statistics, an image gallery, interactive charts, and a 3D model of Klani that visitors could explore. Beyond web development, I also contributed to the physical construction of the prototype by helping with the 3D printing of its components and the assembly of its internal electronic circuit, giving me the opportunity to work with both software and hardware.\n\nAlthough Klani ultimately remained a functional concept and primarily a prototype rather than a fully developed commercial product, POT-C was an important learning experience for our team. We presented the project as part of Expo 2025, Roots of Legacy, sharing our vision of reducing organic waste and encouraging more sustainable practices. For me, POT-C represented an opportunity to combine programming, electronics, 3D printing, and environmental awareness into a single project, while learning how teamwork and technology can help turn an idea into a tangible solution to a real-world problem.",
    pdf: "pdfs/POT-C.pdf"
  },
  cecam: {
    title: "CECAM",
    logoDoubleSize: false,
    logo: "",
    logoWhiteBackground: false,
    accent: "#0800f2",
    status: "prototype",
    role: "Frontend",
    type: ["Web", "Prototype"],
    date: "2025",
    mode: "individual",
    technologies: ["HTML", "CSS", "JavaScript"],
    description: "The CECAM Website was one of my earliest web development projects, started in 2025 with the goal of creating an informative and accessible website for Centro Escolar Católico Alberto Masferrer, an educational institution in El Salvador. The idea was to provide students, parents, and visitors with information about the school, its academic programs, activities, and facilities. The website was designed to include interactive navigation, photo galleries, academic information, testimonials, and Google Maps integration. I was responsible for developing the front end, mainly using HTML and CSS to build its structure, design, and user interface.\n\nAlthough the project never progressed beyond its early development stage and remained an unfinished prototype, it became an important part of my journey as a developer. As one of my first attempts at building a larger website for a real institution, it helped me strengthen my HTML and CSS skills, explore responsive design, and understand how to organize information into a functional and visually appealing interface. Even without reaching completion, CECAM gave me valuable experience, improved my confidence in web development, and helped lay the foundation for the more ambitious projects I would create in the following years.",
    pdf: "pdfs/CECAM.pdf"
  },
  "pets-health": {
    title: "Pet's Health",
    logoDoubleSize: true,
    logo: "images/icons/pets-health.png",
    logoWhiteBackground: true,
    accent: "#EDDAAC",
    status: "prototype",
    role: "Frontend / Organization",
    type: ["Mobile App", "Prototype"],
    date: "2024",
    mode: "team",
    technologies: ["Figma", "Microsoft Power Apps"],
    description: "Pet's Health was a project I worked on in 2024, designed to make pet care easier and more organized through a single digital platform. The idea was to help pet owners keep track of their pets' medical records, appointments, and overall health while also creating a community where they could connect with other pet owners. The platform also aimed to provide access to veterinary services and a marketplace for pet-related products, bringing different aspects of pet care together in one place.\n\nMy role involved contributing to the development of the original concept, working on the front-end design, and writing some of the code needed for the application's basic functionality in Microsoft Power Apps. We initially designed the interface and user experience in Figma before moving part of the project into Power Apps. Although Pet's Health never became a fully developed application and remained an early-stage prototype, it was a valuable experience that helped me explore UI/UX design, low-code development, and the process of turning an idea into an interactive application.\n\nPet's Health was one of my earlier experiences in software development, and while it didn't reach the level of completion we originally imagined, it taught me that every project has value beyond its final result. It helped me understand the importance of planning, collaboration, and building solutions around real needs, while giving me a foundation for the more ambitious projects I would go on to develop.",
    pdf: "pdfs/pets-health.pdf"
  }
};
