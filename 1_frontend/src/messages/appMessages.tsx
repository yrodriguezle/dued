const appMessages = {
  error: {
    loginError: 'Utente o password non validi!',
    networkError: 'Connessione con il server non disponibile!',
    mutation: "Si è verificato un errore tentando di eseguire l'operazione!",
    action: 'Riprova',
  },
  token: {
    title: 'Accesso negato!',
    accept: 'Ok',
  },
  app: {
    beforeunload: {
      title: "Chiudere l'app?",
      body: "Sei sicuro di voler chiudere l'app?",
    },
  },
  pendingWork: {
    body: 'Sono presenti delle modifiche non salvate! \n Sei sicuro di voler abbandonare?',
    accept: 'Sì',
    cancel: 'Annulla',
  },
  user: {
    settingsPanel: {
      title: 'Impostazioni generali',
    },
    messagesPanel: {
      title: 'Messaggi e avvisi',
    },
    userPanel: {
      title: 'Impostazioni utente',
    },
    deleteAvatarDialog: {
      title: 'Elimina avatar',
      subText: "Confermi di voler eliminare l'avatar dal profilo?",
      accept: 'Sì',
      cancel: 'Annulla',
    },
    targetMessagesPanel: {
      title: 'Avvisi',
    },
    sessionExpired: {
      subText: "Sesione scaduta",
    },
  },
  accessDeniedDialog: {
    title: 'Accesso negato!',
    body: 'Non sei abilitata o abilitato per la funzione selezionata.',
    accept: 'Ok',
  },
  dataGridRowHeight: {
    title: 'Altezza righe',
    accept: 'Ok',
  },
  attachmentModal: {
    title: 'Allegati',
    grid: {
      cellValidation: {
        attachment: {
          required: "E' necessario caricare un file!",
          size: 'Dimensione del file non consentita!',
        },
      },
    },
    deleteDialog: {
      title: 'Elimina allegato',
      subText: "Confermi di voler eliminare l'allegato o gli allegati?",
      accept: 'Sì',
      cancel: 'Annulla',
    },
  },
  email: {
    message: 'Elaborazione documento o file in corso...',
    errorDownloadPdfDocument: 'Errore nella elaborazione del documento PDF',
    form: {
      to: 'Uno o più indirizzi mail non sono validi!',
      cc: 'Uno o più indirizzi mail non sono validi!',
      ccn: 'Uno o più indirizzi mail non sono validi!',
      attachment: {
        duplicate: 'Non è possibile caricare un file con lo stesso nome!',
        size: 'Dimensione del file non consentita!',
      },
      from: {
        validate: {
          email: "L'indirizzo mail non è valido!",
        },
        title: 'Invio email',
        subText: "Per l'invio è necessario impostare il proprio indirizzo email nel profilo utente!",
        accept: 'Ok',
      },
      success: 'Email inviata con successo!',
    },
    attachment: {
      confirm: {
        title: 'Rimuovi allegato',
        body: "Confermi di voler rimuovere l'allegato: ",
        accept: 'Sì',
        cancel: 'Annulla',
      },
    },
    signature: {
      messages: {
        success: 'La firma è stata salvata con successo!',
        error: 'Si è verificato un errore salvando la firma!',
      },
      confirm: {
        body: 'Sono presenti delle modifiche non salvate! \n Sei sicuro di voler abbandonare?',
        accept: 'Sì',
        cancel: 'Annulla',
      },
    },
  },
  filter: {
    fieldsPanel: {
      title: 'Aggiungi campi filtro',
    },
    filterUnsaved: {
      body: 'Sono presenti delle modifiche non salvate! \n Sei sicuro di voler abbandonare?',
      accept: 'Sì',
      cancel: 'Annulla',
    },
    deleteDialog: {
      title: 'Elimina filtro',
      subText: 'Confermi di voler eliminare il filtro?',
      accept: 'Sì',
      cancel: 'Annulla',
    },
    renameDialog: {
      title: 'Rinomina filtro',
      subText: 'Nome non consentito in quanto esiste un filtro con lo stesso nome!',
      accept: 'OK',
    },
    nameDialog: {
      title: 'Nome filtro',
      accept: 'OK',
    },
    error: 'Si è verificato un errore salvando il filtro di selezione!',
    valuesError: 'Mancano dei valori nel filtro!',
    bracketsError: "E' necessaria la corretta apertura e chiusura delle parentesi!",
    save: {
      success: 'Il filtro è stato salvato con successo!',
    },
  },
  updates: {
    download: 'Download',
  },
  datagrid: {
    clipboard: {
      copy: {
        single: 'riga copiata!',
        multiple: 'righe copiate!',
      },
      copySelection: 'Selezione copiata!',
      paste: {
        noData: 'Nessun dato da incollare',
        single: 'riga incollata!',
        multiple: 'righe incollate!',
      },
    },
    deleteRows: {
      subText: 'Confermi di voler eliminare la riga o le righe selezionate?',
      accept: 'Sì',
      cancel: 'Annulla',
    },
    importData: {
      title: 'Importazione dati esterni',
      subText: 'I file caricati devono essere file EXCEL!',
      riconciliazioneText: 'Il file caricato non corrisponde al formato impostato!',
      messageAccept: 'OK',
    },
  },
  targetMessage: {
    success: 'Avviso inviato con successo!',
  },
  homePage: {
    actions: {
      noLinks: 'Non ci sono links da mostrare!',
    },
  },
  validation: {
    codExists: 'Il codice non esiste!',
    requiredField: 'Il valore è obbligatorio!',
  },
  evasioneOrdini: {
    accept: 'Sì',
    cancel: 'No',
    errors: {
      validation: {
        codLotto: 'Il codice lotto non esiste!',
      },
      differences: 'Attenzione! Ci sono ordini con codice pagamento e/o luogo destinazione differenti da quelli nel documento!',
      saldoOrdine: 'Attenzione! Il rigo risulta a saldo ordine! \n Vuoi considerare la variazione quantità ancora a saldo rigo ordine?',
    },
    differenceCodLuoDes: 'Attenzione! Uno o più ordini selezionati hanno un <b>luogo destinazione</b> differente da quello del documento.\n Vuoi mantenere luogo destinazione del documento?',
    differenceCodPag: 'Attenzione! Uno o più ordini selezionati hanno un <b>codice pagamento</b> differente da quello del documento.\n Vuoi mantenere il codice pagamento del documento?',
  },
  dashboards: {
    confirm: {
      body: 'Sei sicuro di voler nascondere questo grafico?',
      accept: 'Sì',
      cancel: 'Annulla',
    },
  },
};

export default appMessages;
