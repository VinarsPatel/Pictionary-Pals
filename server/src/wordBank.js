const PACKS = {
  default: [
    "apple",
    "banana",
    "carrot",
    "elephant",
    "football",
    "guitar",
    "house",
    "internet",
    "jungle",
    "kangaroo",
    "laptop",
    "mountain",
    "notebook",
    "ocean",
    "piano",
    "quilt",
    "rocket",
    "sunflower",
    "train",
    "umbrella",
    "violin",
    "watermelon",
    "xylophone",
    "yacht",
    "zebra",
  ],
  animals: [
    "elephant",
    "giraffe",
    "penguin",
    "dolphin",
    "kangaroo",
    "octopus",
    "flamingo",
    "hedgehog",
    "crocodile",
    "butterfly",
    "squirrel",
    "peacock",
    "koala",
    "walrus",
    "cheetah",
    "raccoon",
    "otter",
    "seahorse",
    "toucan",
    "platypus",
  ],
  food: [
    "pizza",
    "burger",
    "sushi",
    "pancake",
    "spaghetti",
    "taco",
    "waffle",
    "sandwich",
    "popcorn",
    "cupcake",
    "avocado",
    "pretzel",
    "donut",
    "lemonade",
    "burrito",
    "noodles",
    "croissant",
    "milkshake",
    "pineapple",
    "meatball",
  ],
  movies: [
    "superhero",
    "spaceship",
    "dinosaur",
    "wizard",
    "pirate",
    "robot",
    "vampire",
    "dragon",
    "ghost",
    "zombie",
    "detective",
    "astronaut",
    "ninja",
    "mermaid",
    "alien",
    "castle",
    "treasure",
    "volcano",
    "submarine",
    "time machine",
  ],
}

function packNames() {
  return Object.keys(PACKS)
}

function isValidPack(name) {
  return Object.prototype.hasOwnProperty.call(PACKS, name)
}

// Avoids repeating any word still in `recentWords` unless every word in the
// pack has been used recently (small packs — better a rare repeat than
// getting stuck).
function pickWord(recentWords = [], packName = "default") {
  const words = PACKS[packName] || PACKS.default
  const candidates = words.filter((w) => !recentWords.includes(w))
  const pool = candidates.length > 0 ? candidates : words
  return pool[Math.floor(Math.random() * pool.length)]
}

module.exports = { PACKS, packNames, isValidPack, pickWord }
