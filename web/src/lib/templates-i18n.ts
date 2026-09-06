import type { LanguageCode } from "./languages";
import type { CampaignKind } from "./types";

/**
 * The starting message, in the language it will actually be sent in.
 *
 * The language selector already existed and already worked: it set the
 * campaign's language, and personalisation wrote in it. What it did not do was
 * change the words sitting in the editor, so an Italian gym picked Italian,
 * read an English draft, and had to translate casdey's own template by hand
 * before it could send anything. Choosing a language and being handed English
 * is worse than not offering the choice.
 *
 * These are written, not machine-translated at runtime. A win-back message is
 * signed by the gym and read by a member who is already half gone, so the
 * register matters more than the literal words: every version keeps casdey's
 * copy rules (no em dashes, nothing asserted about the member, no manufactured
 * urgency, one thing to do) and uses the address a gym would actually use with
 * its own members, which is why the German is "du" and the French "tu" rather
 * than the formal forms a translation service would reach for.
 *
 * The merge fields are identical in every language. They are code, not copy.
 */

export type MessageTemplate = { subject: string; body: string };
export type FollowUpTemplate = MessageTemplate & { afterDays: number };

export type TemplateSet = {
  winBack: MessageTemplate;
  winBackFollowUps: FollowUpTemplate[];
  atRisk: MessageTemplate;
  atRiskFollowUps: FollowUpTemplate[];
};

const en: TemplateSet = {
  winBack: {
    subject: "It has been a while since your last visit",
    body: `Hi {{first_name}},

It has been a while since we last saw you at {{gym}}, and we wanted to check you are getting on well.

{{offer}}

If you would like to come back in, reply to this email and we will find you a time that works.

If now is not the right time, that is completely fine.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Following up",
      body: `Hi {{first_name}},

I wrote a few days ago and I know how easily these things get buried, so this is just a nudge in case it did.

The offer still stands, and coming back in does not have to mean picking up where you left off. One session is fine.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Last one from me",
      body: `Hi {{first_name}},

This is the last time I will write about this, so nothing more from us after today.

If you ever want to come back, you would be welcome, and you know where we are.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Everything OK? Haven't seen you in a bit",
    body: `Hi {{first_name}},

We noticed it has been a little while since your last visit to {{gym}}, so wanted to check in, that's all.

No pressure either way, just reply if there is anything getting in the way of coming back in, we would like to know.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "Still here if you need anything",
      body: `Hi {{first_name}},

Just following up on my note from last week, no pressure at all.

If something is getting in the way of getting in, tell me what it is and I will see what we can do about it.

{{gym}}`,
    },
  ],
};

const it: TemplateSet = {
  winBack: {
    subject: "È passato un po' dall'ultima volta che ci siamo visti",
    body: `Ciao {{first_name}},

è passato un po' dall'ultima volta che ti abbiamo visto da {{gym}}, e volevamo sapere come stai.

{{offer}}

Se ti va di tornare, rispondi a questa email e troviamo insieme un orario che funzioni per te.

Se non è il momento giusto, va benissimo lo stesso.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Ti riscrivo al volo",
      body: `Ciao {{first_name}},

ti ho scritto qualche giorno fa e so quanto è facile che un'email finisca sepolta, quindi questo è solo un promemoria nel caso sia successo.

La proposta resta valida, e tornare non vuol dire per forza ripartire da dove avevi lasciato. Va bene anche una sola sessione.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Ultima email da parte mia",
      body: `Ciao {{first_name}},

questa è l'ultima volta che ti scrivo a riguardo, quindi dopo oggi non ti disturbiamo più.

Se un giorno ti va di tornare sei il benvenuto, e sai dove trovarci.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Tutto bene? Non ti vediamo da un po'",
    body: `Ciao {{first_name}},

abbiamo notato che è passato un po' dalla tua ultima visita da {{gym}}, così volevamo solo sentirti.

Nessuna fretta, ma se c'è qualcosa che ti sta rendendo difficile tornare, scrivicelo, ci farebbe piacere saperlo.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "Siamo qui se ti serve qualcosa",
      body: `Ciao {{first_name}},

ti riscrivo solo per il messaggio della settimana scorsa, senza nessuna pressione.

Se c'è qualcosa che ti impedisce di venire, dimmi di cosa si tratta e vediamo cosa possiamo fare.

{{gym}}`,
    },
  ],
};

const es: TemplateSet = {
  winBack: {
    subject: "Hace tiempo que no te vemos por aquí",
    body: `Hola {{first_name}},

hace tiempo que no te vemos por {{gym}}, y queríamos saber cómo estás.

{{offer}}

Si te apetece volver, responde a este correo y buscamos juntos una hora que te venga bien.

Y si no es el momento, no pasa absolutamente nada.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Te escribo de nuevo",
      body: `Hola {{first_name}},

te escribí hace unos días y sé lo fácil que es que un correo se pierda, así que esto es solo un recordatorio por si acaso.

La propuesta sigue en pie, y volver no significa retomarlo todo donde lo dejaste. Con una sesión basta.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Último correo por mi parte",
      body: `Hola {{first_name}},

esta es la última vez que te escribo sobre esto, así que después de hoy no te molestamos más.

Si algún día quieres volver, serás bienvenido, y ya sabes dónde estamos.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "¿Todo bien? Hace unos días que no te vemos",
    body: `Hola {{first_name}},

hemos visto que hace un tiempo de tu última visita a {{gym}}, así que queríamos saber cómo va todo, nada más.

Sin prisa, pero si hay algo que te está complicando volver, cuéntanoslo, nos gustaría saberlo.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "Seguimos aquí para lo que necesites",
      body: `Hola {{first_name}},

te escribo por mi mensaje de la semana pasada, sin ninguna presión.

Si hay algo que te impide venir, dime qué es y vemos qué podemos hacer.

{{gym}}`,
    },
  ],
};

const fr: TemplateSet = {
  winBack: {
    subject: "Cela fait un moment qu'on ne t'a pas vu",
    body: `Bonjour {{first_name}},

cela fait un moment qu'on ne t'a pas vu à {{gym}}, et on voulait prendre de tes nouvelles.

{{offer}}

Si tu as envie de revenir, réponds à cet email et on trouvera un créneau qui te convient.

Et si ce n'est pas le bon moment, ce n'est vraiment pas grave.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Petit rappel",
      body: `Bonjour {{first_name}},

je t'ai écrit il y a quelques jours et je sais à quel point un email se perd vite, donc voici juste un rappel au cas où.

La proposition tient toujours, et revenir ne veut pas dire reprendre là où tu t'étais arrêté. Une seule séance, c'est très bien.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Dernier message de ma part",
      body: `Bonjour {{first_name}},

c'est la dernière fois que je t'écris à ce sujet, tu n'entendras plus parler de nous après aujourd'hui.

Si un jour tu veux revenir, tu seras le bienvenu, et tu sais où nous trouver.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Tout va bien ? On ne t'a pas vu ces derniers temps",
    body: `Bonjour {{first_name}},

on a remarqué que cela faisait un petit moment depuis ta dernière venue à {{gym}}, alors on voulait simplement prendre de tes nouvelles.

Aucune pression, mais s'il y a quelque chose qui t'empêche de revenir, dis-le nous, cela nous intéresse.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "On reste là si tu as besoin",
      body: `Bonjour {{first_name}},

je reviens vers toi après mon message de la semaine dernière, sans aucune pression.

Si quelque chose t'empêche de venir, dis-moi ce que c'est et je verrai ce qu'on peut faire.

{{gym}}`,
    },
  ],
};

const de: TemplateSet = {
  winBack: {
    subject: "Wir haben dich eine Weile nicht gesehen",
    body: `Hallo {{first_name}},

wir haben dich schon eine Weile nicht mehr bei {{gym}} gesehen und wollten fragen, wie es dir geht.

{{offer}}

Wenn du wieder vorbeikommen möchtest, antworte einfach auf diese E-Mail und wir finden einen Termin, der dir passt.

Und wenn es gerade nicht passt, ist das völlig in Ordnung.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Kurz nachgefragt",
      body: `Hallo {{first_name}},

ich habe dir vor ein paar Tagen geschrieben, und weil solche E-Mails schnell untergehen, hier nur eine kurze Erinnerung.

Das Angebot steht weiterhin, und zurückkommen heißt nicht, dort weiterzumachen, wo du aufgehört hast. Eine einzige Einheit reicht völlig.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Letzte Nachricht von mir",
      body: `Hallo {{first_name}},

das ist das letzte Mal, dass ich dich deswegen anschreibe, nach heute hörst du nichts mehr von uns.

Wenn du irgendwann zurückkommen möchtest, bist du willkommen, und du weißt, wo du uns findest.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Alles gut bei dir? Wir haben dich länger nicht gesehen",
    body: `Hallo {{first_name}},

uns ist aufgefallen, dass dein letzter Besuch bei {{gym}} schon etwas her ist, deshalb wollten wir einfach kurz nachfragen.

Ganz ohne Druck. Falls dir gerade etwas im Weg steht, schreib es uns, wir würden es gern wissen.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "Wir sind da, falls du etwas brauchst",
      body: `Hallo {{first_name}},

ich komme noch einmal auf meine Nachricht von letzter Woche zurück, ganz ohne Druck.

Wenn dich etwas davon abhält vorbeizukommen, sag mir was es ist und ich schaue, was sich machen lässt.

{{gym}}`,
    },
  ],
};

const nl: TemplateSet = {
  winBack: {
    subject: "We hebben je een tijdje niet gezien",
    body: `Hoi {{first_name}},

we hebben je alweer een tijdje niet gezien bij {{gym}}, en we wilden even vragen hoe het met je gaat.

{{offer}}

Wil je weer eens langskomen, antwoord dan gewoon op deze mail en we zoeken samen een moment dat jou uitkomt.

En als het nu even niet uitkomt, is dat helemaal prima.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Even een herinnering",
      body: `Hoi {{first_name}},

ik schreef je een paar dagen geleden, en omdat zulke mails snel ondersneeuwen is dit even een herinnering.

Het aanbod staat nog steeds, en terugkomen betekent niet dat je verder moet waar je gebleven was. Eén sessie is ook goed.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Laatste mail van mij",
      body: `Hoi {{first_name}},

dit is de laatste keer dat ik je hierover schrijf, na vandaag hoor je niets meer van ons.

Wil je ooit terugkomen, dan ben je welkom, en je weet ons te vinden.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Alles goed? We zagen je even niet",
    body: `Hoi {{first_name}},

het viel ons op dat je laatste bezoek aan {{gym}} alweer even geleden is, dus we wilden even laten weten dat we aan je dachten.

Geen haast, maar als er iets is waardoor terugkomen lastig is, laat het ons weten, dat horen we graag.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "We staan voor je klaar",
      body: `Hoi {{first_name}},

ik kom nog even terug op mijn bericht van vorige week, zonder enige druk.

Als er iets is waardoor je niet langskomt, zeg het me en ik kijk wat we kunnen doen.

{{gym}}`,
    },
  ],
};

const pt: TemplateSet = {
  winBack: {
    subject: "Já há algum tempo que não te vemos",
    body: `Olá {{first_name}},

já há algum tempo que não te vemos no {{gym}}, e queríamos saber como estás.

{{offer}}

Se quiseres voltar, responde a este email e encontramos um horário que te sirva.

E se agora não for a altura certa, não há problema nenhum.

{{gym}}`,
  },
  winBackFollowUps: [
    {
      afterDays: 4,
      subject: "Só um lembrete",
      body: `Olá {{first_name}},

escrevi-te há uns dias e sei como estes emails se perdem facilmente, por isso fica aqui só um lembrete.

A proposta mantém-se, e voltar não significa retomar tudo onde paraste. Uma sessão já é suficiente.

{{gym}}`,
    },
    {
      afterDays: 7,
      subject: "Último email da minha parte",
      body: `Olá {{first_name}},

esta é a última vez que te escrevo sobre isto, depois de hoje não voltamos a incomodar.

Se um dia quiseres voltar, és bem-vindo, e sabes onde nos encontrar.

{{gym}}`,
    },
  ],
  atRisk: {
    subject: "Está tudo bem? Não te temos visto",
    body: `Olá {{first_name}},

reparámos que já passou algum tempo desde a tua última visita ao {{gym}}, por isso queríamos apenas saber como vai isso.

Sem pressa nenhuma, mas se houver alguma coisa a dificultar a tua vinda, diz-nos, gostávamos de saber.

{{gym}}`,
  },
  atRiskFollowUps: [
    {
      afterDays: 6,
      subject: "Estamos cá para o que precisares",
      body: `Olá {{first_name}},

volto ao meu email da semana passada, sem qualquer pressão.

Se houver alguma coisa a impedir-te de vir, diz-me o que é e vejo o que podemos fazer.

{{gym}}`,
    },
  ],
};

const SETS: Record<LanguageCode, TemplateSet> = { en, it, es, fr, de, nl, pt };

/**
 * The template set for a language, falling back to English.
 *
 * English is the fallback rather than an error because a campaign must always
 * have something in the editor. A language casdey has not written copy for is
 * a gap in the library, not a reason to hand the gym an empty box.
 */
export function templateSet(language: string): TemplateSet {
  return SETS[language as LanguageCode] ?? en;
}

export function defaultMessage(
  language: string,
  kind: CampaignKind,
): MessageTemplate {
  const set = templateSet(language);
  return kind === "at_risk" ? set.atRisk : set.winBack;
}

export function defaultFollowUpsFor(
  language: string,
  kind: CampaignKind,
): FollowUpTemplate[] {
  const set = templateSet(language);
  return kind === "at_risk" ? set.atRiskFollowUps : set.winBackFollowUps;
}
