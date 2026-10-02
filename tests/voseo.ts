/**
 * Detector de voseo para el copy del sitio.
 *
 * El sitio habla en español de Colombia, con tuteo. El voseo rioplatense
 * ("querés", "mirá", "contanos") se coló en el copy original y no rompe ningún
 * build: la única forma de que no vuelva es un test.
 *
 * Es una red de seguridad, no un analizador morfológico. Cubre tres cosas:
 *   1. Presente de "vos": toda palabra terminada en -ás / -és / -ís (querés,
 *      tenés, usás, escribís...), salvo las pocas legítimas y los futuros de
 *      "tú" (podrás, verás, aprenderás), que terminan igual.
 *   2. Imperativos y formas con clítico: una lista explícita (mirá, contá,
 *      hacelo, quedate...). El tuteo acentúa el clítico ("compáralo"), el voseo no.
 *   3. Los pronombres "vos" y "sos".
 *
 * Quedan fuera a propósito las formas que también son tuteo o primera persona
 * ("dale", "pedí", "decidí" = yo decidí): darían falsos positivos. Si el copy
 * nuevo trae un voseo que no se detecta, se agrega a la lista.
 */

const palabras = (texto: string): Set<string> => new Set(texto.split(/\s+/).filter(Boolean));

/** Terminan en -ás / -és / -ís pero no son voseo. */
const LEGITIMAS = palabras(`
  más además demás atrás detrás jamás quizás compás estás nicolás
  después interés través inglés francés portugués holandés escocés irlandés revés cortés marqués andrés inés estés
  país anís parís
`);

/**
 * Futuros de "tú" (podrás, verás, tendrás, sabrás, querrás) terminan igual que
 * el presente de "vos" de verbos como "mirar" o "preparar". Se tratan como
 * tuteo para no dar falsos positivos; los voseos que caen acá van en EXPLICITAS.
 */
const FUTURO_TU = /(?:[aei]r|dr|br|rr)ás$/;

const PRESENTE_VOS = /^[a-záéíóúüñ]{2,}(?:ás|és|ís)$/;

const EXPLICITAS = palabras(`
  mirás tirás girás respirás preparás separás reparás declarás cobrás ahorrás corrás

  mirá contá pasá usá activá automatizá arrancá avisá bloqueá buscá cambiá clasificá dejá empezá frená ganá guardá
  habilitá migrá preguntá prestá restaurá sumá verificá amortizá agendá reservá completá consultá probá comprá enviá
  andá tomá esperá revisá pensá creá descargá entrá ingresá aprovechá evitá chequeá controlá configurá conectá cerrá
  copiá pegá cargá ejecutá hablá escuchá solicitá cotizá recordá tratá aplicá implementá confirmá calculá compará
  terminá
  aprendé hacé corré conocé resolvé entendé leé mantené poné tené
  elegí definí medí asumí
  decime unite

  mirate miralo miralos mirala miralas contanos contame avisanos buscanos dejanos agendanos reservanos consultanos
  escribinos escribime llamanos llamame llamalo mandanos mandame hablanos escuchanos contactanos comunicanos conocenos
  usalo usala usalos activalo automatizalo hacelo hacela instalalo separalas separalos quedate sumate fijate acordate
  olvidate imaginate registrate anotate sentate ponete ponelo tenelo probalo terminalo resolvelo leelo recordalo
  buscalo buscala aplicalo implementalo mantenelo verificalo confirmalo calculalo medilo empezalo

  vos
`);

/** Palabras con voseo encontradas en el texto, sin repetir y en orden de aparición. */
export const findVoseo = (text: string): string[] => {
  const found = new Set<string>();

  for (const token of text.match(/[\p{L}]+/gu) ?? []) {
    const word = token.toLowerCase();

    // "SOS" en mayúsculas es la señal de socorro; "sos" / "Sos" es el verbo.
    if (word === 'sos' && token !== 'SOS') {
      found.add(word);
      continue;
    }

    if (EXPLICITAS.has(word)) {
      found.add(word);
      continue;
    }

    if (PRESENTE_VOS.test(word) && !LEGITIMAS.has(word) && !FUTURO_TU.test(word)) {
      found.add(word);
    }
  }

  return [...found];
};
