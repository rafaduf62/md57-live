import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
console.log("APP CSS CHARGE");
import md57Logo from "./assets/md57-logo-transparent.png"; 

const CLUB_NAME = "Moselle Darts 57";

function App() {
  console.log("MD57 APP CHARGEE");
  const [matches, setMatches] = useState([]);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [spectateursLive, setSpectateursLive] = useState(0);
  const [matchAlerte, setMatchAlerte] = useState(null);
  const dernierMatchAlerte = useRef(null);
  const initialisationAlertes = useRef(false);
  const audioContextRef = useRef(null);
const alertesSonoresActivees = useRef(false);

  const [settings, setSettings] = useState({
    tournoi: "",
    lieu: "",
  });

  const [activeTab, setActiveTab] = useState("live");

  const [tournoi, setTournoi] = useState("");
  const [lieu, setLieu] = useState("");

  const [joueur, setJoueur] = useState("");
  const [adversaire, setAdversaire] = useState("");

  const [clubJoueur, setClubJoueur] = useState(CLUB_NAME);
  const [clubAdversaire, setClubAdversaire] = useState("");

  const [cible, setCible] = useState("");
  const [manchesGagnantes, setManchesGagnantes] = useState(3);

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ==================================================
  // AUTHENTIFICATION ADMIN
  // ==================================================

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const isAdminRoute =
    window.location.pathname === "/admin";
    
  // ==================================================
  // VÉRIFICATION DE L'ADMINISTRATEUR
  // ==================================================

  useEffect(() => {
    let actif = true;

    const verifierAdmin = async () => {
      const {
        data: { session: sessionActuelle },
      } = await supabase.auth.getSession();

      if (!actif) return;

      setSession(sessionActuelle);

      if (!sessionActuelle?.user?.id) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", sessionActuelle.user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Erreur vérification administrateur :",
          error
        );

        setIsAdmin(false);
      } else {
        setIsAdmin(isAdminRoute && !!data);
      }

      setAuthLoading(false);
    };

    verifierAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nouvelleSession) => {
  setSession(nouvelleSession);

  if (!nouvelleSession?.user?.id) {
    setIsAdmin(false);
    return;
  }

  supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", nouvelleSession.user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        console.error(
          "Erreur vérification administrateur :",
          error
        );
        setIsAdmin(false);
      } else {
        setIsAdmin(isAdminRoute && !!data);
      }
    });
}
    );

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
  const sessionId = crypto.randomUUID();

  const channel = supabase.channel("md57-live-viewers");

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();

      const nombreSpectateurs = Object.values(state).reduce(
        (total, personnes) => total + personnes.length,
        0
      );

      setSpectateursLive(nombreSpectateurs);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          session_id: sessionId,
          type: "spectateur",
        });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  // ==================================================
  // CONNEXION ADMINISTRATEUR
  // ==================================================

  const connexionAdmin = async (e) => {
    e.preventDefault();

    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (error) {
      console.error("Erreur connexion admin :", error);
      setMessage("Identifiant ou mot de passe incorrect.");
      return;
    }

    setAdminPassword("");
    setMessage("Connexion administrateur réussie.");
  };

  const deconnexionAdmin = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setSession(null);
  };

  // ==================================================
  // CHARGEMENT DES MATCHS
  // ==================================================

  const loadMatches = async () => {
    const { data, error } = await supabase
      .from("live_matches")
      .select("*")
      .or(
        `club_joueur.eq.${CLUB_NAME},club_adversaire.eq.${CLUB_NAME}`
      )
      .order("id", { ascending: false });

    if (error) {
      console.error("Erreur chargement matchs :", error);
      return;
    }

    setMatches(data || []);


  };
  // ==================================================
  // CHARGEMENT DES PARAMÈTRES
  // ==================================================
useEffect(() => {
  const matchsEnCours = matches.filter(
    (match) => match.statut === "En cours"
  );

  if (!initialisationAlertes.current) {
    dernierMatchAlerte.current = new Set(
      matchsEnCours.map((match) => match.id)
    );

    initialisationAlertes.current = true;
    return;
  }

  const nouveauMatch = matchsEnCours.find(
    (match) => !dernierMatchAlerte.current.has(match.id)
  );

  if (nouveauMatch) {
    setMatchAlerte(nouveauMatch);
  }

  dernierMatchAlerte.current = new Set(
    matchsEnCours.map((match) => match.id)
  );
}, [matches]);
  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("live_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("Erreur chargement paramètres :", error);
      return;
    }

    if (data) {
      setSettings({
        tournoi: data.tournoi || "",
        lieu: data.lieu || "",
      });

      setTournoi(data.tournoi || "");
      setLieu(data.lieu || "");
    }
  };

  // ==================================================
  // INITIALISATION
  // ==================================================

  useEffect(() => {
    loadSettings();
    const activerAlertesSonores = () => {
  const AudioContext =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return;
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContext();
  }

  audioContextRef.current.resume();
  alertesSonoresActivees.current = true;

  const oscillator = audioContextRef.current.createOscillator();
  const gainNode = audioContextRef.current.createGain();

  oscillator.frequency.value = 880;
  oscillator.type = "sine";

  gainNode.gain.setValueAtTime(
    0.0001,
    audioContextRef.current.currentTime
  );

  gainNode.gain.exponentialRampToValueAtTime(
    0.25,
    audioContextRef.current.currentTime + 0.02
  );

  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContextRef.current.currentTime + 0.25
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContextRef.current.destination);

  oscillator.start();
  oscillator.stop(
    audioContextRef.current.currentTime + 0.25
  );
};
    loadMatches();

    const interval = setInterval(() => {
      loadMatches();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // ==================================================
  // MATCHS EN DIRECT
  // ==================================================

  const liveMatches = useMemo(() => {
    return matches
      .filter((match) => match.statut === "En cours")
      .sort(
        (a, b) =>
          Number(a.cible_numero || 999) -
          Number(b.cible_numero || 999)
      );
  }, [matches]);

  // ==================================================
  // MATCHS TERMINÉS
  // ==================================================

  const completedMatches = useMemo(() => {
    return matches
      .filter((match) => match.statut === "Terminé")
      .sort(
        (a, b) =>
          Number(b.id || 0) -
          Number(a.id || 0)
      );
  }, [matches]);

  const latestMatches = completedMatches.slice(0, 10);

  // ==================================================
  // PARAMÈTRES DU TOURNOI
  // ==================================================

  const saveSettings = async () => {
    setMessage("");

    const tournoiFinal =
      tournoi.trim() || settings.tournoi.trim();

    const lieuFinal =
      lieu.trim() || settings.lieu.trim();

    if (!tournoiFinal) {
      setMessage("⚠️ Le nom du tournoi est obligatoire.");
      return;
    }

    if (!lieuFinal) {
      setMessage("⚠️ Le lieu est obligatoire.");
      return;
    }

    const { error } = await supabase
      .from("live_settings")
      .update({
        tournoi: tournoiFinal,
        lieu: lieuFinal,
      })
      .eq("id", 1);

    if (error) {
      console.error("Erreur paramètres :", error);

      setMessage(
        `❌ Erreur : ${error.message}`
      );

      return;
    }

    setSettings({
      tournoi: tournoiFinal,
      lieu: lieuFinal,
    });

    setTournoi(tournoiFinal);
    setLieu(lieuFinal);

    setMessage("✅ Paramètres enregistrés.");
  };

  // ==================================================
  // CRÉATION D'UN MATCH
  // ==================================================

  const createMatch = async (event) => {
    event.preventDefault();

    setMessage("");

    if (!joueur.trim()) {
      setMessage("⚠️ Le nom du joueur est obligatoire.");
      return;
    }

    if (!adversaire.trim()) {
      setMessage("⚠️ Le nom de l'adversaire est obligatoire.");
      return;
    }

    if (!cible) {
      setMessage("⚠️ Merci de choisir une cible.");
      return;
    }

    const targetNumber = Number(cible);
    const winningLegs = Number(manchesGagnantes);

    // --------------------------------------------------
    // TOURNOI
    // --------------------------------------------------

    const tournoiFinal =
      tournoi.trim() ||
      settings.tournoi.trim();

    if (!tournoiFinal) {
      setMessage(
        "⚠️ Le nom du tournoi est obligatoire."
      );

      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // VÉRIFICATION DE LA CIBLE
    // --------------------------------------------------

    const { data: existingTarget, error: targetError } =
      await supabase
        .from("live_matches")
        .select("id")
        .eq("cible_numero", targetNumber)
        .eq("statut", "En cours")
        .maybeSingle();

    if (targetError) {
      console.error(
        "Erreur vérification cible :",
        targetError
      );

      setMessage(
        `❌ Erreur vérification cible : ${targetError.message}`
      );

      setLoading(false);
      return;
    }

    if (existingTarget) {
      setMessage(
        `⚠️ La cible ${targetNumber} est déjà utilisée par un match en cours.`
      );

      setLoading(false);
      return;
    }

    setLoading(true);

    // --------------------------------------------------
    // NOUVEAU MATCH
    // --------------------------------------------------

    const nouveauMatch = {
      tournoi: tournoiFinal,

      joueur: joueur.trim(),
      adversaire: adversaire.trim(),

      table_numero: targetNumber,
      cible_numero: targetNumber,

      score_joueur: 0,
      score_adversaire: 0,

      statut: "En cours",

      resultat: null,

      club_joueur:
        clubJoueur.trim() || CLUB_NAME,

      club_adversaire:
        clubAdversaire.trim() || "Autre club",

      manches_gagnantes: winningLegs,
    };

    console.log(
      "Nouveau match :",
      nouveauMatch
    );

    const { error } = await supabase
      .from("live_matches")
      .insert([nouveauMatch]);

    if (error) {
      console.error(
        "Erreur création match :",
        error
      );

      setMessage(
        `❌ Impossible de créer le match : ${error.message}`
      );

      setLoading(false);
      return;
    }

    // --------------------------------------------------
    // RÉINITIALISATION
    // --------------------------------------------------

    setMessage(
      `✅ Match créé sur la cible ${targetNumber} !`
    );

    setJoueur("");
    setAdversaire("");

    setClubJoueur(CLUB_NAME);
    setClubAdversaire("");

    setCible("");
    setManchesGagnantes(3);

    await loadMatches();

    setActiveTab("live");

    setLoading(false);
  };

  // ==================================================
  // MODIFICATION D'UN MATCH
  // ==================================================

  const startEdit = (match) => {
    setEditingId(match.id);

    setJoueur(match.joueur || "");
    setAdversaire(match.adversaire || "");

    setClubJoueur(
      match.club_joueur || CLUB_NAME
    );

    setClubAdversaire(
      match.club_adversaire || ""
    );

    setCible(
      match.cible_numero ||
      match.table_numero ||
      ""
    );

    setManchesGagnantes(
      Number(match.manches_gagnantes || 3)
    );
  };

  // ==================================================
  // ANNULER MODIFICATION
  // ==================================================

  const cancelEdit = () => {
    setEditingId(null);

    setJoueur("");
    setAdversaire("");

    setClubJoueur(CLUB_NAME);
    setClubAdversaire("");

    setCible("");
    setManchesGagnantes(3);
  };

  // ==================================================
  // ENREGISTRER MODIFICATION
  // ==================================================

  const updateMatch = async (event) => {
    event.preventDefault();

    if (!editingId) return;

    if (!joueur.trim() || !adversaire.trim()) {
      setMessage(
        "⚠️ Les deux joueurs sont obligatoires."
      );

      return;
    }

    if (!cible) {
      setMessage(
        "⚠️ Merci de choisir une cible."
      );

      return;
    }

    setLoading(true);
    setMessage("");

    const targetNumber = Number(cible);

    const { error } = await supabase
      .from("live_matches")
      .update({
        joueur: joueur.trim(),
        adversaire: adversaire.trim(),

        club_joueur:
          clubJoueur.trim() || CLUB_NAME,

        club_adversaire:
          clubAdversaire.trim() ||
          "Autre club",

        table_numero: targetNumber,
        cible_numero: targetNumber,

        manches_gagnantes:
          Number(manchesGagnantes),
      })
      .eq("id", editingId);

    if (error) {
      console.error(
        "Erreur modification :",
        error
      );

      setMessage(
        `❌ Erreur modification : ${error.message}`
      );

      setLoading(false);
      return;
    }

    setMessage(
      "✅ Match modifié avec succès."
    );

    cancelEdit();

    await loadMatches();

    setLoading(false);
  };

  // ==================================================
  // MODIFICATION DU SCORE
  // ==================================================

  const updateScore = async (
    match,
    player,
    amount
  ) => {
      if (!isAdmin || !isAdminRoute) {
    return;
  }
    if (match.statut !== "En cours") {
      return;
    }

    let newScoreJoueur = Number(
      match.score_joueur || 0
    );

    let newScoreAdversaire = Number(
      match.score_adversaire || 0
    );

    // --------------------------------------------------
    // SCORE JOUEUR
    // --------------------------------------------------

    if (player === "joueur") {
      newScoreJoueur = Math.max(
        0,
        newScoreJoueur + amount
      );
    }

    // --------------------------------------------------
    // SCORE ADVERSAIRE
    // --------------------------------------------------

    if (player === "adversaire") {
      newScoreAdversaire = Math.max(
        0,
        newScoreAdversaire + amount
      );
    }

    const maxLegs = Number(
      match.manches_gagnantes || 3
    );

    let statut = "En cours";
    let resultat = null;

    // --------------------------------------------------
    // VICTOIRE JOUEUR
    // --------------------------------------------------

    if (newScoreJoueur >= maxLegs) {
      newScoreJoueur = maxLegs;

      statut = "Terminé";

      resultat =
        `${match.joueur} gagne`;
    }

    // --------------------------------------------------
    // VICTOIRE ADVERSAIRE
    // --------------------------------------------------

    if (
      newScoreAdversaire >= maxLegs
    ) {
      newScoreAdversaire = maxLegs;

      statut = "Terminé";

      resultat =
        `${match.adversaire} gagne`;
    }

    // --------------------------------------------------
    // SAUVEGARDE
    // --------------------------------------------------

    const { error } = await supabase
      .from("live_matches")
      .update({
        score_joueur:
          newScoreJoueur,

        score_adversaire:
          newScoreAdversaire,

        statut,
        resultat,
      })
      .eq("id", match.id);

    if (error) {
      console.error(
        "Erreur mise à jour score :",
        error
      );

      setMessage(
        `❌ Erreur score : ${error.message}`
      );

      return;
    }

    await loadMatches();

    // --------------------------------------------------
    // FIN DU MATCH
    // --------------------------------------------------

    if (statut === "Terminé") {
      setActiveTab("latest");
    }
  };

  // ==================================================
  // SUPPRESSION
  // ==================================================

  const deleteMatch = async (id) => {
    const confirmation =
      window.confirm(
        "Voulez-vous vraiment supprimer ce match ?"
      );

    if (!confirmation) {
      return;
    }

    const { error } = await supabase
      .from("live_matches")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "Erreur suppression :",
        error
      );

      setMessage(
        `❌ Impossible de supprimer le match : ${error.message}`
      );

      return;
    }

    setMessage(
      "✅ Match supprimé."
    );

    await loadMatches();
  };

  // ==================================================
  // COULEUR DU SCORE
  // ==================================================

  const getScoreClass = (
    score,
    opponentScore
  ) => {
    if (score > opponentScore) {
      return "score-green";
    }

    if (score < opponentScore) {
      return "score-red";
    }

    return "score-neutral";
  };

  // ==================================================
  // CARTE MATCH EN DIRECT
  // ==================================================

  const LiveMatchCard = ({ match }) => {
  const scoreJoueur = Number(
    match.score_joueur || 0
  );

  const scoreAdversaire = Number(
    match.score_adversaire || 0
  );

  return (
    
    <div className="live-match-card">

      <div className="match-top">

        <div className="target-badge">
          🎯 CIBLE {match.cible_numero}
        </div>

        <div className="match-status">
          🔴 EN DIRECT
        </div>

      </div>

      <div className="players">

        {/* JOUEUR MOSELLE DARTS */}

        <div className="player">

          <div className="player-name">
            {match.joueur}
          </div>

          <div className="player-club">
            {match.club_joueur || ""}
          </div>

          <div
            className={`score-number ${getScoreClass(
              scoreJoueur,
              scoreAdversaire
            )}`}
          >
            {scoreJoueur}
          </div>

          <div className="score-buttons">

            {isAdmin && (
              <button
                className="score-minus"
                onClick={() =>
                  updateScore(
                    match,
                    "joueur",
                    -1
                  )
                }
                disabled={scoreJoueur === 0}
              >
                −
              </button>
            )}

            {isAdmin && (
              <button
                className="score-plus"
                onClick={() =>
                  updateScore(
                    match,
                    "joueur",
                    1
                  )
                }
              >
                +1
              </button>
            )}

          </div>

        </div>

        {/* VS */}

        <div className="versus">
          VS
        </div>

        {/* ADVERSAIRE */}

        <div className="player">

          <div className="player-name">
            {match.adversaire}
          </div>

          <div className="player-club">
            {match.club_adversaire || ""}
          </div>

          <div
            className={`score-number ${getScoreClass(
              scoreAdversaire,
              scoreJoueur
            )}`}
          >
            {scoreAdversaire}
          </div>

          <div className="score-buttons">

            {isAdmin && (
              <button
                className="score-minus"
                onClick={() =>
                  updateScore(
                    match,
                    "adversaire",
                    -1
                  )
                }
                disabled={scoreAdversaire === 0}
              >
                −
              </button>
            )}

            {isAdmin && (
              <button
                className="score-plus"
                onClick={() =>
                  updateScore(
                    match,
                    "adversaire",
                    1
                  )
                }
              >
                +1
              </button>
            )}

          </div>

        </div>

      </div>

      <div className="progression">
        🏆 PREMIER À{" "}
        {match.manches_gagnantes}{" "}
        MANCHES
      </div>

    </div>
  );
};
  // ==================================================
  // CARTE RÉSULTAT
  // ==================================================

  const ResultCard = ({ match }) => {
    const scoreJoueur = Number(
      match.score_joueur || 0
    );

    const scoreAdversaire = Number(
      match.score_adversaire || 0
    );

    const joueurGagnant =
      scoreJoueur > scoreAdversaire;

    const adversaireGagnant =
      scoreAdversaire > scoreJoueur;

    return (
      <div className="result-card">

        <div className="result-header">

          <span>
            🎯 CIBLE{" "}
            {match.cible_numero}
          </span>

          <span className="finished-badge">
            TERMINÉ
          </span>

        </div>

        <div className="result-players">

          <div
            className={`result-player ${
              joueurGagnant
                ? "winner"
                : ""
            }`}
          >

            <span>
              {joueurGagnant &&
                "🏆 "}
              {match.joueur}
            </span>

            <strong>
              {scoreJoueur}
            </strong>

          </div>

          <div className="result-vs">
            VS
          </div>

          <div
            className={`result-player ${
              adversaireGagnant
                ? "winner"
                : ""
            }`}
          >

            <span>
              {adversaireGagnant &&
                "🏆 "}
              {match.adversaire}
            </span>

            <strong>
              {scoreAdversaire}
            </strong>

          </div>

        </div>
        
        <div className="result-footer">
          {match.resultat ||
            "Match terminé"}
        </div>

        {isAdmin && isAdminRoute && (
  <div className="result-actions">

          <button
          
          hidden={!isAdmin}
            onClick={() =>
              startEdit(match)
            }
          >
            ✏️ Modifier
          </button>

          <button
          hidden={!isAdmin}
            className="delete-button"
            onClick={() =>
              deleteMatch(match.id)
            }
          >
            🗑️ Supprimer
          </button>

        </div>
)}
      </div>
    );
  };

  // ==================================================
  // CONTENU DES ONGLETS
  // ==================================================

  const renderSpectatorContent = () => {

    // ------------------------------------------------
    // EN DIRECT
    // ------------------------------------------------

    if (activeTab === "live") {
      return (
        <>
          <div className="section-title">

            <h2>
              🔴 Matchs en direct
            </h2>

            <span>
              {liveMatches.length} match
              {liveMatches.length > 1
                ? "s"
                : ""}
            </span>

          </div>

          {liveMatches.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                🎯
              </div>

              <h3>
                Aucun match en cours
              </h3>

              <p>
                Les prochains matchs
                apparaîtront ici
                automatiquement.
              </p>

            </div>

          ) : (

            <div className="live-grid">

              {liveMatches.map(
                (match) => (
                  <LiveMatchCard
                    key={match.id}
                    match={match}
                  />
                )
              )}

            </div>

          )}
        </>
      );
    }

    // ------------------------------------------------
    // DERNIERS MATCHS
    // ------------------------------------------------

    if (activeTab === "latest") {
      return (
        <>
          <div className="section-title">

            <h2>
              🏆 Derniers matchs
            </h2>

            <span>
              {latestMatches.length} résultat
              {latestMatches.length > 1
                ? "s"
                : ""}
            </span>

          </div>

          {latestMatches.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                🏆
              </div>

              <h3>
                Aucun match terminé
              </h3>

              <p>
                Les résultats
                apparaîtront ici dès
                qu'un match sera
                terminé.
              </p>

            </div>

          ) : (

            <div className="results-grid">

              {latestMatches.map(
                (match) => (
                  <ResultCard
                    key={match.id}
                    match={match}
                  />
                )
              )}

            </div>

          )}
        </>
      );
    }
        // ------------------------------------------------
    // TOUS LES RÉSULTATS
    // ------------------------------------------------
    return (
      <>
        <div className="section-title">

          <h2>
            📋 Tous les résultats
          </h2>

          <span>
            {completedMatches.length} match
            {completedMatches.length > 1
              ? "s"
              : ""}
          </span>

        </div>

        {completedMatches.length === 0 ? (

          <div className="empty-state">

            <div className="empty-icon">
              📋
            </div>

            <h3>
              Aucun résultat
            </h3>

            <p>
              L'historique des matchs
              terminés apparaîtra ici.
            </p>

          </div>

        ) : (

          <div className="results-grid">

            {completedMatches.map(
              (match) => (
                <ResultCard
                  key={match.id}
                  match={match}
                />
              )
            )}

          </div>

        )}
        

      {isAdminRoute && !isAdmin && (
        <div className="admin-login">
          <h2>🔐 Administration</h2>

          <p>Connexion réservée à l'administrateur</p>

          <form onSubmit={connexionAdmin}>
            <input
              type="email"
              placeholder="Adresse e-mail"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              type="password"
              placeholder="Mot de passe"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button type="submit">
              🔐 SE CONNECTER
            </button>
          </form>

          {message && (
            <p className="admin-message">
              {message}
            </p>
          )}
        </div>
      )}
          </>
  );
};
  // ==================================================
  // AFFICHAGE
  // ==================================================
  
console.log("MD57 RETURN PRINCIPAL");

return (
  
  <>
<div className="spectateurs-live">
  🟢 👁️ {spectateursLive} personne{spectateursLive > 1 ? "s" : ""} suivent le LIVE
</div>
    <div
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 99999,
        background: "red",
        color: "white",
        padding: "15px",
        borderRadius: "10px",
        fontWeight: "bold",
      }}
    >
      🔊 TEST SON
    </div>

    {matchAlerte && (
      <div className="match-alert">
        <div className="match-alert-box">

          <div className="match-alert-title">
            🔔 MATCH MOSELLE DARTS !
          </div>

          <div className="match-alert-target">
            🎯 CIBLE {matchAlerte.cible_numero}
          </div>

          <div className="match-alert-players">
            <strong>{matchAlerte.joueur}</strong>
            <span>VS</span>
            <strong>{matchAlerte.adversaire}</strong>
          </div>

          <div className="match-alert-legs">
            🏆 PREMIER À {matchAlerte.manches_gagnantes} MANCHES
          </div>

          <button
            type="button"
            onClick={() => setMatchAlerte(null)}
            className="match-alert-close"
          >
            OK, J'AI VU
          </button>

        </div>
      </div>
    )}

    {isAdminRoute && !isAdmin && (
  <div className="admin-login">
    <h2>🔐 Administration</h2>

    <p>Connexion réservée à l'administrateur</p>

    <form onSubmit={connexionAdmin}>
      <input
        type="email"
        placeholder="Adresse e-mail"
        value={adminEmail}
        onChange={(e) => setAdminEmail(e.target.value)}
        autoComplete="email"
      />

      <input
        type="password"
        placeholder="Mot de passe"
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
        autoComplete="current-password"
      />

      <button type="submit">
        🔐 SE CONNECTER
      </button>
    </form>

    {message && (
      <p className="admin-message">
        {message}
      </p>
    )}
  </div>
)}
      
    <div className="app">

      {/* HEADER */}

      <header className="app-header">

  <div className="header-content">

    {/* GAUCHE : LOGO ET NOM DU CLUB */}
    <div className="brand">

  <img
    src={md57Logo}
    alt="Moselle Darts 57"
    className="brand-logo"
  />

  <div>
    <h1>
      MOSELLE DARTS 57
    </h1>

    <p>
      LIVE SCORE
    </p>
  </div>

</div>
    {/* CENTRE : DÉCONNEXION ADMIN */}
    <div className="admin-header-action">

      {isAdminRoute && isAdmin && (
        <button
          type="button"
          onClick={deconnexionAdmin}
          className="admin-logout"
        >
          🚪 Déconnexion
        </button>
      )}

    </div>

    {/* DROITE : TOURNOI ET VILLE */}
    
    <div className="tournament-info">

      <strong>
        {settings.tournoi ||
          tournoi ||
          "Tournoi"}
      </strong>

      <span>
        📍{" "}
        {settings.lieu ||
          lieu ||
          "Lieu"}
      </span>

    </div>
<button
  type="button"
  className="menu-button"
  onClick={() => setMenuOuvert(true)}
  aria-label="Ouvrir le menu"
>
  ☰
</button>
  </div>

</header>

{menuOuvert && (
  <div className="menu-overlay">
    <div className="side-menu">

      <button
        type="button"
        className="menu-close"
        onClick={() => setMenuOuvert(false)}
        aria-label="Fermer le menu"
      >
        ✕
      </button>

      <div className="side-menu-title">
        🦁 MD57 LIVE
      </div>

      <nav className="side-menu-nav">
        <button type="button">🏠 Accueil</button>
        <button type="button">🔴 Live</button>
        <button type="button">🏆 Tournois</button>
        <button type="button">🥇 Championnat</button>
        <button type="button">📊 Classements</button>
        <button type="button">👥 Membres</button>
        <button type="button">📅 Événements</button>
        <button type="button">🎯 Entraînements</button>
        <button type="button">📰 Actualités</button>
        <button type="button">🛍️ Boutique</button>
        <button type="button">📸 Galerie</button>
        <button type="button">🤝 Partenaires</button>
        <button type="button">💬 Communauté</button>
        <button type="button">⚙️ Administration</button>
      </nav>

    </div>
  </div>
)}

<main className="container"></main>

      <main className="container">

        {/* ONGLET */}

        <div className="spectator-tabs">

          <button
            className={
              activeTab === "live"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("live")
            }
          >

            🔴 EN DIRECT

            {liveMatches.length > 0 && (
              <span className="tab-count">
                {liveMatches.length}
              </span>
            )}

          </button>

          <button
            className={
              activeTab === "latest"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("latest")
            }
          >
            🏆 DERNIERS MATCHS
          </button>

          <button
            className={
              activeTab === "results"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("results")
            }
          >
            📋 TOUS LES RÉSULTATS
          </button>

        </div>

        {/* SPECTATEUR */}

        <section className="spectator-section">
          {renderSpectatorContent()}
        </section>

        {/* ADMINISTRATION */}

{isAdminRoute && isAdmin && (
  <section className="admin-section">

          <div className="admin-title">

            <h2>
              ⚙️ Administration
            </h2>

            <span>
              Gestion du tournoi
            </span>

          </div>

          {message && (
            <div className="admin-message">
              {message}
            </div>
          )}

          {/* PARAMÈTRES */}

          <div className="admin-card">

            <h3>
              🏆 Paramètres du tournoi
            </h3>

            <div className="form-grid">

              <div className="form-group">

                <label>
                  Nom du tournoi
                </label>

                <input
                  type="text"
                  value={tournoi}
                  onChange={(e) =>
                    setTournoi(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="form-group">

                <label>
                  Lieu
                </label>

                <input
                  type="text"
                  value={lieu}
                  onChange={(e) =>
                    setLieu(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            <button
              type="button"
              className="primary-button"
              onClick={saveSettings}
            >
              💾 Enregistrer les paramètres
            </button>

          </div>

          {/* CRÉATION / MODIFICATION */}

          <div
            className="admin-card"
            id="formulaire-match"
          >

            <h3>
              {editingId
                ? "✏️ Modifier le match"
                : "➕ Ajouter un match"}
            </h3>

            <form
              onSubmit={
                editingId
                  ? updateMatch
                  : createMatch
              }
            >

              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Joueur
                  </label>

                  <input
                    type="text"
                    placeholder="Nom du joueur"
                    value={joueur}
                    onChange={(e) =>
                      setJoueur(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Adversaire
                  </label>

                  <input
                    type="text"
                    placeholder="Nom de l'adversaire"
                    value={adversaire}
                    onChange={(e) =>
                      setAdversaire(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Club du joueur
                  </label>

                  <input
                    type="text"
                    value={clubJoueur}
                    onChange={(e) =>
                      setClubJoueur(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Club adverse
                  </label>

                  <input
                    type="text"
                    placeholder="Club de l'adversaire"
                    value={
                      clubAdversaire
                    }
                    onChange={(e) =>
                      setClubAdversaire(
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    🎯 Numéro de cible
                  </label>

                  <select
                    value={cible}
                    onChange={(e) =>
                      setCible(
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      Choisir une cible
                    </option>

                    {Array.from(
                      {
                        length: 30,
                      },
                      (_, index) =>
                        index + 1
                    ).map(
                      (numero) => (
                        <option
                          key={numero}
                          value={numero}
                        >
                          Cible{" "}
                          {numero}
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    🏆 Manches gagnantes
                  </label>

                  <select
                    value={
                      manchesGagnantes
                    }
                    onChange={(e) =>
                      setManchesGagnantes(
                        Number(
                          e.target.value
                        )
                      )
                    }
                  >

                    {Array.from(
                      {
                        length: 10,
                      },
                      (_, index) =>
                        index + 1
                    ).map(
                      (numero) => (
                        <option
                          key={numero}
                          value={numero}
                        >
                          Premier à{" "}
                          {numero}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

              <div className="form-actions">

                <button
                hidden={!isAdmin}
                  type="submit"
                  className="primary-button"
                  disabled={loading}
                >
                  {loading
                    ? "⏳ Enregistrement..."
                    : editingId
                    ? "💾 Enregistrer les modifications"
                    : "➕ Créer le match"}
                </button>

                {editingId && (

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={cancelEdit}
                  >
                    ❌ Annuler
                  </button>

                )}

              </div>

            </form>

          </div>

        </section>
        )}
      {/* ==================================================
    GESTION DES MATCHS
================================================== */}

{isAdminRoute && isAdmin && (
  <section className="admin-section">

          <div className="admin-title">

            <h2>
              📋 Gestion des matchs
            </h2>

            <span>
              Administration des résultats
            </span>

          </div>

          {matches.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                🎯
              </div>

              <h3>
                Aucun match enregistré
              </h3>

              <p>
                Les matchs créés apparaîtront
                ici pour leur gestion.
              </p>

            </div>

          ) : (

            <div className="admin-matches-list">

              {matches.map((match) => (

                <div
                  className="admin-match-row"
                  key={match.id}
                >

                  <div className="admin-match-info">

                    <div className="admin-target">
                      🎯 Cible{" "}
                      {match.cible_numero}
                    </div>

                    <div className="admin-players">

                      <strong>
                        {match.joueur}
                      </strong>

                      <span>
                        VS
                      </span>

                      <strong>
                        {match.adversaire}
                      </strong>

                    </div>

                    <div className="admin-clubs">

                      <span>
                        {match.club_joueur ||
                          "Autre club"}
                      </span>

                      <span>
                        /
                      </span>

                      <span>
                        {match.club_adversaire ||
                          "Autre club"}
                      </span>

                    </div>

                    <div className="admin-score">

                      <strong>
                        {Number(
                          match.score_joueur || 0
                        )}
                      </strong>

                      <span>
                        -
                      </span>

                      <strong>
                        {Number(
                          match.score_adversaire ||
                            0
                        )}
                      </strong>

                    </div>

                    <div className="admin-status">

                      {match.statut ===
                      "En cours" ? (
                        <span className="status-live">
                          🔴 EN COURS
                        </span>
                      ) : (
                        <span className="status-finished">
                          🏁 TERMINÉ
                        </span>
                      )}

                    </div>

                  </div>

                  <div className="admin-match-actions">

                    <button
                      type="button"
                      className="edit-button"
                      onClick={() =>
                        startEdit(match)
                      }
                    >
                      ✏️ Modifier
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        deleteMatch(match.id)
                      }
                    >
                      🗑️ Supprimer
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>
)}
      </main>


      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer className="app-footer">

        <div className="footer-content">

          <div className="footer-brand">

            <span className="footer-lion">
              🦁
            </span>

            <div>

              <strong>
                MOSELLE DARTS 57
              </strong>

              <span>
                Live Score
              </span>

            </div>

          </div>

          <div className="footer-center">

            <span>
              🎯 Gestion des matchs en direct
            </span>

          </div>

          <div className="footer-right">

            <span>
              Live Score • Florange
            </span>

          </div>

        </div>

      </footer>

    </div>
      </>
  );
}
export default App;