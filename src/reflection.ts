import { stableHash, type Locale, type Persona } from "./oracle";

/**
 * Reflection prompts are invitations to think, not predictions or diagnoses.
 * The same day and birth date always select the same prompt in both locales.
 */
const prompts: Record<Locale, Record<Persona, readonly string[]>> = {
  en: {
    mystic: [
      "If the universe could ask you one question today, what would you hope it asked?",
      "Which small coincidence could you turn into a deliberate act of kindness?",
      "What familiar thing might look extraordinary if you noticed it again?",
      "If today had a secret doorway, what tiny adventure would be behind it?",
      "What would you try if you treated uncertainty as an invitation?",
      "Which ordinary moment deserves a little ceremony today?",
      "What might happen if you followed curiosity instead of a schedule for five minutes?",
      "What would the stars miss about your day if they only counted achievements?",
    ],
    skeptic: [
      "What do you believe today that you would happily change your mind about?",
      "Which small experiment could make your day a little better?",
      "What assumption could you test instead of defending?",
      "What is one question worth asking even without an immediate answer?",
      "What would count as evidence that you were wrong about something minor?",
      "What could you notice today without needing to explain it?",
      "Which habit is useful because it works, rather than because it sounds impressive?",
      "What is one small choice you can make without consulting an oracle?",
    ],
  },
  fi: {
    mystic: [
      "Jos maailmankaikkeus saisi kysyä sinulta tänään yhden asian, mitä toivoisit sen kysyvän?",
      "Minkä pienen sattuman voisit muuttaa tietoiseksi ystävällisyydeksi?",
      "Mikä tuttu asia voisi näyttää ihmeelliseltä, jos huomaisit sen uudelleen?",
      "Jos tässä päivässä olisi salainen ovi, millainen pieni seikkailu sen takana odottaisi?",
      "Mitä kokeilisit, jos pitäisit epävarmuutta kutsuna?",
      "Mikä tavallinen hetki ansaitsisi tänään pienen juhlan?",
      "Mitä tapahtuisi, jos seuraisit uteliaisuutta aikataulun sijaan viiden minuutin ajan?",
      "Mitä tähdiltä jäisi päivästäsi huomaamatta, jos ne laskisivat vain saavutuksia?",
    ],
    skeptic: [
      "Mistä tämänpäiväisestä käsityksestäsi voisit ilomielin muuttaa mieltäsi?",
      "Millainen pieni kokeilu voisi tehdä päivästäsi paremman?",
      "Minkä oletuksen voisit testata sen sijaan, että puolustaisit sitä?",
      "Mikä kysymys kannattaa esittää, vaikka vastausta ei heti löytyisi?",
      "Millainen havainto osoittaisi, että olit väärässä jossain pienessä asiassa?",
      "Mitä voisit tänään huomata ilman tarvetta selittää sitä?",
      "Mikä tapa on hyödyllinen siksi, että se toimii, ei siksi, että se kuulostaa hienolta?",
      "Minkä pienen päätöksen voisit tehdä kysymättä oraakkelilta?",
    ],
  },
};

export function dailyQuestion(locale: Locale, persona: Persona, date: string, birthDate: string): string {
  const options = prompts[locale][persona];
  const index = stableHash(`${birthDate}:${date}:${persona}:question`) % options.length;
  return options[index];
}
