/**
 * Playful, deterministic interpretations; never medical or predictive claims.
 * Stable across sessions and locale switches. No random calls or network access.
 */
export type Cycles = { physical: number; emotional: number; intellectual: number };
export type Locale = "en" | "fi";
export type Persona = "mystic" | "skeptic";
type CycleName = keyof Cycles;

const messages: Record<Locale, Record<Persona, Record<CycleName, readonly string[]>>> = {
  en: {
    mystic: {
      physical: [
        "Your physical constellation invites a little movement. Even a walk to the kettle counts as an expedition.",
        "The cosmic gym is open. Its membership fee is one curious step outside.",
        "The stars recommend stretching. They have, of course, never had a backache.",
        "A small adventure awaits. Shoes are optional, unless you plan to leave the house.",
      ],
      emotional: [
        "The cosmos recommends kindness. Excellent advice, even if the cosmos never actually said it.",
        "Venus whispers: notice one lovely detail today. The coffee may be a good place to start.",
        "Your emotional tides are poetic today. Be gentle with yourself and the furniture.",
        "A friendly word may travel further than a horoscope. Try sending one.",
      ],
      intellectual: [
        "Your thoughts are sparkling. Write one down before the coffee gets cold.",
        "Mercury suggests an idea worth exploring. Peer review suggests checking the details.",
        "An unexpected question may open a door today. Check whether it has hinges first.",
        "The universe offers inspiration, not documentation. Bring your own notebook.",
      ],
    },
    skeptic: {
      physical: [
        "A sine wave cannot measure your energy. A short walk might still feel good.",
        "Your physical curve is mathematics, not a diagnosis. Your chair, however, may appreciate a break.",
        "No planet prescribed exercise. Consider moving anyway, on your own terms.",
        "Today's data contains no medical insight. It does contain a reminder to stand up occasionally.",
      ],
      emotional: [
        "The stars cannot measure your feelings. You can still notice something pleasant today.",
        "An emotional sine curve is not a mood forecast. Ask yourself what actually matters today.",
        "No controlled experiment has asked Venus to cheer you up. A kind conversation is more promising.",
        "You don't need a cosmic explanation for a good moment. Enjoy it on its own merits.",
      ],
      intellectual: [
        "Your intellectual curve does not predict intelligence. Curiosity remains a useful habit.",
        "The stars have no evidence to offer. Fortunately, curiosity requires no cosmic permission.",
        "A horoscope cannot debug your code. Asking one good question might.",
        "The scientific method has no zodiac sign. It does have excellent follow-up questions.",
      ],
    },
  },
  fi: {
    mystic: {
      physical: [
        "Fyysinen tähtikarttasi kutsuu liikkeelle. Retki kahvipannullekin lasketaan seikkailuksi.",
        "Kosminen kuntosali on avoinna. Jäsenmaksuksi riittää yksi utelias askel ulos.",
        "Tähdet suosittelevat venyttelyä. Niillä itsellään ei tosin ole koskaan ollut selkäkipua.",
        "Pieni seikkailu odottaa. Kengät ovat vapaaehtoiset, ellet aio poistua kotoa.",
      ],
      emotional: [
        "Kosmos suosittelee lempeyttä. Erittäin hyvä neuvo, vaikka kosmos ei sitä oikeasti lähettänyt.",
        "Venus kuiskaa: huomaa tänään yksi kaunis yksityiskohta. Aloita vaikka kahvista.",
        "Tunne-elämäsi vuorovesi on runollinen. Ole lempeä itsellesi ja huonekaluille.",
        "Ystävällinen sana voi kantaa horoskooppia pidemmälle. Kokeile lähettää sellainen.",
      ],
      intellectual: [
        "Ajatukset kipinöivät! Ota ne talteen ennen kuin kahvi jäähtyy.",
        "Merkurius ehdottaa ideaa. Vertaisarviointi suosittelee tarkistamaan yksityiskohdat.",
        "Odottamaton kysymys voi avata oven. Tarkista ensin, onko siinä saranat.",
        "Maailmankaikkeus tarjoaa inspiraatiota, ei dokumentaatiota. Ota muistikirja mukaan.",
      ],
    },
    skeptic: {
      physical: [
        "Sinikäyrä ei mittaa energiaasi. Pieni kävely voi silti tehdä hyvää.",
        "Fyysinen käyrä on matematiikkaa, ei diagnoosi. Tuolisi voisi silti arvostaa taukoa.",
        "Yksikään planeetta ei määrännyt sinua lenkille. Voit silti lähteä omasta tahdostasi.",
        "Päivän datassa ei ole lääketieteellistä tietoa. Mutta välillä kannattaa nousta seisomaan.",
      ],
      emotional: [
        "Tähdet eivät mittaa tunteitasi. Voit silti huomata tänään jotain mukavaa.",
        "Emotionaalinen sinikäyrä ei ennusta mielialaa. Kysy mieluummin, mikä tänään merkitsee.",
        "Venuksen piristyskykyä ei ole osoitettu kokeissa. Ystävällinen keskustelu on lupaavampi ajatus.",
        "Hyvä hetki ei tarvitse kosmista selitystä. Nauti siitä sellaisenaan.",
      ],
      intellectual: [
        "Älyllinen käyrä ei ennusta älykkyyttä. Uteliaisuus on silti hyödyllinen tapa.",
        "Tähdillä ei ole näyttöä tarjottavana. Uteliaisuus ei onneksi tarvitse niiden lupaa.",
        "Horoskooppi ei korjaa koodiasi. Yksi hyvä kysymys saattaa auttaa.",
        "Tieteellisellä menetelmällä ei ole horoskooppimerkkiä. Hyviä jatkokysymyksiä sillä kyllä on.",
      ],
    },
  },
};

/** FNV-1a 32-bit hash. Explicitly not cryptographic. */
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function oracleMessage(
  values: Cycles,
  persona: Persona,
  locale: Locale,
  day: string,
  birthDate: string,
): string {
  const dimensions: CycleName[] = ["physical", "emotional", "intellectual"];
  // Rotate which cycle is featured, rather than always choosing the highest.
  const dimension = dimensions[stableHash(`${birthDate}:${day}:cycle`) % dimensions.length];
  const variants = messages[locale][persona][dimension];
  // Same person/day/persona always selects the same semantic variant in both languages.
  const variant = stableHash(`${birthDate}:${day}:${persona}:${dimension}`) % variants.length;
  // The numbers are used for the graph, not for claims about mental or physical health.
  void values;
  return variants[variant];
}
