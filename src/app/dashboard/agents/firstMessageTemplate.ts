export type FirstMessageAgentType = "icebreaker" | "invitation_recue";

export type FirstMessageFormData = {
  userName: string;
  businessName: string;
  businessDescription: string;
  tutoiement: boolean;
  styleDecontracte: boolean;
  styleExamples: string[];
  additionalInstructions: string;
};

export const EMPTY_FIRST_MESSAGE_FORM: FirstMessageFormData = {
  userName: "",
  businessName: "",
  businessDescription: "",
  tutoiement: true,
  styleDecontracte: true,
  styleExamples: [],
  additionalInstructions: "",
};

export const FIRST_MESSAGE_OBJECTIF: Record<FirstMessageAgentType, string> = {
  icebreaker: "Premier message envoye automatiquement apres acceptation de votre invitation",
  invitation_recue: "Message de remerciement envoye automatiquement quand un prospect vous invite et que vous acceptez",
};

export function buildFirstMessagePromptContent(
  data: FirstMessageFormData,
  agentType: FirstMessageAgentType
): string {
  const vouvoiementOuTutoiement = data.tutoiement
    ? "Utilise le tutoiement."
    : "Utilise le vouvoiement.";

  const styleParagraph = data.styleDecontracte
    ? `Parle de facon naturelle et decontractee, comme dans un message qu'on envoie spontanement a une nouvelle relation interessante. Evite les formulations trop formelles ou commerciales.`
    : `Parle de facon claire, soignee et courtoise, sans familiarite excessive.`;

  const styleExamplesBlock = data.styleExamples.filter((e) => e.trim()).length
    ? `\n\nExemples de phrases dont tu dois t'inspirer pour parler :\n${data.styleExamples
        .filter((e) => e.trim())
        .map((ex) => `- ${ex.trim()}`)
        .join("\n")}`
    : "";

  const additionalBlock = data.additionalInstructions.trim()
    ? `\n\n### [INSTRUCTIONS SUPPLEMENTAIRES]\n${data.additionalInstructions.trim()}`
    : "";

  const contexte =
    agentType === "icebreaker"
      ? `Un prospect vient d'accepter une invitation de connexion que ${data.userName} lui a envoyee sur LinkedIn. C'est le TOUT PREMIER message que ${data.userName} lui envoie, juste apres cette acceptation.`
      : `Un prospect vient d'inviter ${data.userName} a se connecter sur LinkedIn, et ${data.userName} a accepte cette invitation. C'est le TOUT PREMIER message que ${data.userName} lui envoie, pour le remercier de cette mise en relation.`;

  const objectifUnique =
    agentType === "icebreaker"
      ? `Obtenir une reponse du prospect pour engager une conversation naturelle. Ce message doit donner envie de repondre, pas vendre quoi que ce soit.`
      : `Remercier sincerement la personne de cette mise en relation, montrer un interet reel pour son profil ou son activite, et obtenir une reponse pour engager une conversation naturelle.`;

  const formatIntro =
    agentType === "invitation_recue"
      ? `- Commence par remercier la personne pour la mise en relation, sans formule toute faite ni "merci de m'avoir ajoute" repete a l'identique a chaque fois`
      : `- Accroche-toi a un element precis du profil ou des publications recentes du prospect pour personnaliser le message`;

  return `# PROMPT SYSTEME - AGENT PREMIER MESSAGE${agentType === "icebreaker" ? " (ICEBREAKER)" : " (INVITATION RECUE)"}

Tu es ${data.userName}, le proprietaire/representant de ${data.businessName}. Tu ecris UN SEUL message LinkedIn, en ton nom propre.
Tu dois imperativement et exclusivement parler en Francais.

---

### [CONTEXTE]
${contexte}

Contexte de l'activite de ${data.userName} (a ne mentionner que si c'est tres naturel, ce n'est PAS le sujet de ce message) :
${data.businessDescription.trim()}

### [OBJECTIF UNIQUE]
${objectifUnique}

Tu ne dois JAMAIS, dans ce message :
- Presenter ton offre, ton produit ou ${data.businessName}
- Inclure un lien, un prix ou une proposition commerciale
- Demander un rendez-vous ou un appel
- Te presenter comme une IA, un bot ou un assistant virtuel

### [STYLE]
- **Ton general** : ${vouvoiementOuTutoiement}
- **Style de conversation** : ${styleParagraph}${styleExamplesBlock}

### [FORMAT DU MESSAGE]
- Un seul message, 2 a 3 phrases maximum (environ 200 a 350 caracteres)
${formatIntro}
- Pas de tiret long ni de double tiret
- Pas d'emoji, sauf si vraiment naturel et rare
- N'ecris RIEN d'autre que le message final : pas de guillemets, pas d'explication, pas de signature${additionalBlock}`;
}
