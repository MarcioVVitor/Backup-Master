export type Language = "pt" | "en" | "es" | "fr" | "de";

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
];

type TranslationKeys = {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    back: string;
    next: string;
    close: string;
    refresh: string;
    download: string;
    upload: string;
    view: string;
    execute: string;
    connect: string;
    disconnect: string;
    enabled: string;
    disabled: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    actions: string;
    status: string;
    name: string;
    description: string;
    date: string;
    size: string;
    type: string;
    version: string;
  };
  menu: {
    dashboard: string;
    manufacturers: string;
    equipment: string;
    scripts: string;
    executeBackup: string;
    backups: string;
    scheduler: string;
    firmware: string;
    terminal: string;
    administration: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    totalEquipment: string;
    totalBackups: string;
    totalScripts: string;
    recentBackups: string;
    systemStatus: string;
    noRecentBackups: string;
  };
  equipment: {
    title: string;
    subtitle: string;
    addEquipment: string;
    editEquipment: string;
    deleteEquipment: string;
    equipmentName: string;
    ipAddress: string;
    manufacturer: string;
    model: string;
    username: string;
    password: string;
    port: string;
    protocol: string;
    enabled: string;
    noEquipment: string;
    confirmDelete: string;
  };
  manufacturers: {
    title: string;
    subtitle: string;
    addManufacturer: string;
    manufacturerName: string;
    noManufacturers: string;
  };
  scripts: {
    title: string;
    subtitle: string;
    addScript: string;
    editScript: string;
    scriptName: string;
    command: string;
    timeout: string;
    fileExtension: string;
    isDefault: string;
    noScripts: string;
  };
  backups: {
    title: string;
    subtitle: string;
    backupDate: string;
    backupSize: string;
    backupStatus: string;
    viewContent: string;
    downloadBackup: string;
    deleteBackup: string;
    noBackups: string;
    statusSuccess: string;
    statusFailed: string;
    statusPending: string;
  };
  executeBackup: {
    title: string;
    subtitle: string;
    selectEquipment: string;
    selectScript: string;
    executeNow: string;
    executing: string;
    executionComplete: string;
    executionFailed: string;
  };
  scheduler: {
    title: string;
    subtitle: string;
    addPolicy: string;
    editPolicy: string;
    policyName: string;
    frequency: string;
    startTime: string;
    enabled: string;
    lastRun: string;
    nextRun: string;
    noPolicies: string;
    daily: string;
    weekly: string;
    monthly: string;
  };
  firmware: {
    title: string;
    subtitle: string;
    repository: string;
    recovery: string;
    uploadFirmware: string;
    firmwareName: string;
    firmwareVersion: string;
    selectManufacturer: string;
    noFirmware: string;
    selectScript: string;
    selectEquipment: string;
    executeRecovery: string;
  };
  terminal: {
    title: string;
    subtitle: string;
    selectEquipment: string;
    connected: string;
    disconnected: string;
    connecting: string;
    sendCommand: string;
    clearTerminal: string;
    theme: string;
  };
  admin: {
    title: string;
    subtitle: string;
    users: string;
    config: string;
    backup: string;
    system: string;
    updates: string;
    addUser: string;
    editUser: string;
    deleteUser: string;
    username: string;
    email: string;
    password: string;
    role: string;
    isAdmin: string;
    noUsers: string;
    systemName: string;
    serverIp: string;
    primaryColor: string;
    logoUrl: string;
    language: string;
    selectLanguage: string;
    saveConfig: string;
    themes: string;
    backgrounds: string;
    exportBackup: string;
    importBackup: string;
    systemInfo: string;
    checkUpdates: string;
    applyUpdate: string;
    currentVersion: string;
    latestVersion: string;
    upToDate: string;
    updateAvailable: string;
    permissionLevels: string;
    administrator: string;
    operator: string;
    viewer: string;
  };
  login: {
    title: string;
    subtitle: string;
    loginWithReplit: string;
    loggingIn: string;
  };
};

type Translations = Record<Language, TranslationKeys>;

export const translations: Translations = {
  pt: {
    common: {
      save: "Salvar",
      cancel: "Cancelar",
      delete: "Excluir",
      edit: "Editar",
      add: "Adicionar",
      search: "Buscar",
      filter: "Filtrar",
      loading: "Carregando...",
      error: "Erro",
      success: "Sucesso",
      confirm: "Confirmar",
      back: "Voltar",
      next: "Próximo",
      close: "Fechar",
      refresh: "Atualizar",
      download: "Baixar",
      upload: "Enviar",
      view: "Visualizar",
      execute: "Executar",
      connect: "Conectar",
      disconnect: "Desconectar",
      enabled: "Ativado",
      disabled: "Desativado",
      yes: "Sim",
      no: "Não",
      all: "Todos",
      none: "Nenhum",
      actions: "Ações",
      status: "Status",
      name: "Nome",
      description: "Descrição",
      date: "Data",
      size: "Tamanho",
      type: "Tipo",
      version: "Versão",
    },
    menu: {
      dashboard: "Dashboard",
      manufacturers: "Fabricantes",
      equipment: "Equipamentos",
      scripts: "Scripts",
      executeBackup: "Executar Backup",
      backups: "Backups",
      scheduler: "Scheduler",
      firmware: "Firmware",
      terminal: "Terminal",
      administration: "Administração",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Visão geral do sistema de backup",
      totalEquipment: "Total de Equipamentos",
      totalBackups: "Total de Backups",
      totalScripts: "Scripts Disponíveis",
      recentBackups: "Backups Recentes",
      systemStatus: "Status do Sistema",
      noRecentBackups: "Nenhum backup recente",
    },
    equipment: {
      title: "Equipamentos",
      subtitle: "Gerencie os equipamentos de rede",
      addEquipment: "Novo Equipamento",
      editEquipment: "Editar Equipamento",
      deleteEquipment: "Excluir Equipamento",
      equipmentName: "Nome do Equipamento",
      ipAddress: "Endereço IP",
      manufacturer: "Fabricante",
      model: "Modelo",
      username: "Usuário",
      password: "Senha",
      port: "Porta",
      protocol: "Protocolo",
      enabled: "Ativo",
      noEquipment: "Nenhum equipamento cadastrado",
      confirmDelete: "Confirma a exclusão deste equipamento?",
    },
    manufacturers: {
      title: "Fabricantes",
      subtitle: "Gerencie os fabricantes de equipamentos",
      addManufacturer: "Novo Fabricante",
      manufacturerName: "Nome do Fabricante",
      noManufacturers: "Nenhum fabricante cadastrado",
    },
    scripts: {
      title: "Scripts",
      subtitle: "Scripts de backup e atualização",
      addScript: "Novo Script",
      editScript: "Editar Script",
      scriptName: "Nome do Script",
      command: "Comando",
      timeout: "Timeout (ms)",
      fileExtension: "Extensão do Arquivo",
      isDefault: "Script Padrão",
      noScripts: "Nenhum script cadastrado",
    },
    backups: {
      title: "Backups",
      subtitle: "Histórico de backups realizados",
      backupDate: "Data do Backup",
      backupSize: "Tamanho",
      backupStatus: "Status",
      viewContent: "Ver Conteúdo",
      downloadBackup: "Baixar Backup",
      deleteBackup: "Excluir Backup",
      noBackups: "Nenhum backup encontrado",
      statusSuccess: "Sucesso",
      statusFailed: "Falhou",
      statusPending: "Pendente",
    },
    executeBackup: {
      title: "Executar Backup",
      subtitle: "Execute backups manualmente",
      selectEquipment: "Selecione os equipamentos",
      selectScript: "Selecione o script",
      executeNow: "Executar Agora",
      executing: "Executando...",
      executionComplete: "Backup concluído com sucesso",
      executionFailed: "Falha na execução do backup",
    },
    scheduler: {
      title: "Scheduler",
      subtitle: "Políticas de backup automatizado",
      addPolicy: "Nova Política",
      editPolicy: "Editar Política",
      policyName: "Nome da Política",
      frequency: "Frequência",
      startTime: "Horário de Início",
      enabled: "Ativo",
      lastRun: "Última Execução",
      nextRun: "Próxima Execução",
      noPolicies: "Nenhuma política configurada",
      daily: "Diário",
      weekly: "Semanal",
      monthly: "Mensal",
    },
    firmware: {
      title: "Firmware",
      subtitle: "Repositório de imagens e recuperação",
      repository: "Repositório",
      recovery: "Recuperação",
      uploadFirmware: "Upload Firmware",
      firmwareName: "Nome do Firmware",
      firmwareVersion: "Versão",
      selectManufacturer: "Selecione o fabricante",
      noFirmware: "Nenhum firmware cadastrado",
      selectScript: "Selecione o script",
      selectEquipment: "Selecione o equipamento",
      executeRecovery: "Executar Recuperação",
    },
    terminal: {
      title: "Terminal",
      subtitle: "Terminal SSH interativo",
      selectEquipment: "Selecione um equipamento",
      connected: "Conectado",
      disconnected: "Desconectado",
      connecting: "Conectando...",
      sendCommand: "Enviar comando",
      clearTerminal: "Limpar Terminal",
      theme: "Tema",
    },
    admin: {
      title: "Administração",
      subtitle: "Gestão de usuários e configurações",
      users: "Usuários",
      config: "Configurações",
      backup: "Backup",
      system: "Sistema",
      updates: "Atualizações",
      addUser: "Novo Usuário",
      editUser: "Editar Usuário",
      deleteUser: "Excluir Usuário",
      username: "Usuário",
      email: "Email",
      password: "Senha",
      role: "Permissão",
      isAdmin: "Administrador",
      noUsers: "Nenhum usuário encontrado",
      systemName: "Nome do Sistema",
      serverIp: "IP do Servidor",
      primaryColor: "Cor Principal",
      logoUrl: "URL do Logo",
      language: "Idioma",
      selectLanguage: "Selecione o idioma",
      saveConfig: "Salvar Configurações",
      themes: "Temas do Sistema",
      backgrounds: "Plano de Fundo",
      exportBackup: "Exportar Backup",
      importBackup: "Importar Backup",
      systemInfo: "Informações do Sistema",
      checkUpdates: "Verificar Atualizações",
      applyUpdate: "Aplicar Atualização",
      currentVersion: "Versão Atual",
      latestVersion: "Versão Disponível",
      upToDate: "Sistema está atualizado!",
      updateAvailable: "Nova versão disponível!",
      permissionLevels: "Níveis de Permissão",
      administrator: "Administrador",
      operator: "Operador",
      viewer: "Visualizador",
    },
    login: {
      title: "NBM - Network Backup Manager",
      subtitle: "Faça login para continuar",
      loginWithReplit: "Entrar com Replit",
      loggingIn: "Entrando...",
    },
  },
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      search: "Search",
      filter: "Filter",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      confirm: "Confirm",
      back: "Back",
      next: "Next",
      close: "Close",
      refresh: "Refresh",
      download: "Download",
      upload: "Upload",
      view: "View",
      execute: "Execute",
      connect: "Connect",
      disconnect: "Disconnect",
      enabled: "Enabled",
      disabled: "Disabled",
      yes: "Yes",
      no: "No",
      all: "All",
      none: "None",
      actions: "Actions",
      status: "Status",
      name: "Name",
      description: "Description",
      date: "Date",
      size: "Size",
      type: "Type",
      version: "Version",
    },
    menu: {
      dashboard: "Dashboard",
      manufacturers: "Manufacturers",
      equipment: "Equipment",
      scripts: "Scripts",
      executeBackup: "Execute Backup",
      backups: "Backups",
      scheduler: "Scheduler",
      firmware: "Firmware",
      terminal: "Terminal",
      administration: "Administration",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Backup system overview",
      totalEquipment: "Total Equipment",
      totalBackups: "Total Backups",
      totalScripts: "Available Scripts",
      recentBackups: "Recent Backups",
      systemStatus: "System Status",
      noRecentBackups: "No recent backups",
    },
    equipment: {
      title: "Equipment",
      subtitle: "Manage network equipment",
      addEquipment: "New Equipment",
      editEquipment: "Edit Equipment",
      deleteEquipment: "Delete Equipment",
      equipmentName: "Equipment Name",
      ipAddress: "IP Address",
      manufacturer: "Manufacturer",
      model: "Model",
      username: "Username",
      password: "Password",
      port: "Port",
      protocol: "Protocol",
      enabled: "Enabled",
      noEquipment: "No equipment registered",
      confirmDelete: "Confirm deletion of this equipment?",
    },
    manufacturers: {
      title: "Manufacturers",
      subtitle: "Manage equipment manufacturers",
      addManufacturer: "New Manufacturer",
      manufacturerName: "Manufacturer Name",
      noManufacturers: "No manufacturers registered",
    },
    scripts: {
      title: "Scripts",
      subtitle: "Backup and update scripts",
      addScript: "New Script",
      editScript: "Edit Script",
      scriptName: "Script Name",
      command: "Command",
      timeout: "Timeout (ms)",
      fileExtension: "File Extension",
      isDefault: "Default Script",
      noScripts: "No scripts registered",
    },
    backups: {
      title: "Backups",
      subtitle: "Backup history",
      backupDate: "Backup Date",
      backupSize: "Size",
      backupStatus: "Status",
      viewContent: "View Content",
      downloadBackup: "Download Backup",
      deleteBackup: "Delete Backup",
      noBackups: "No backups found",
      statusSuccess: "Success",
      statusFailed: "Failed",
      statusPending: "Pending",
    },
    executeBackup: {
      title: "Execute Backup",
      subtitle: "Run backups manually",
      selectEquipment: "Select equipment",
      selectScript: "Select script",
      executeNow: "Execute Now",
      executing: "Executing...",
      executionComplete: "Backup completed successfully",
      executionFailed: "Backup execution failed",
    },
    scheduler: {
      title: "Scheduler",
      subtitle: "Automated backup policies",
      addPolicy: "New Policy",
      editPolicy: "Edit Policy",
      policyName: "Policy Name",
      frequency: "Frequency",
      startTime: "Start Time",
      enabled: "Enabled",
      lastRun: "Last Run",
      nextRun: "Next Run",
      noPolicies: "No policies configured",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
    },
    firmware: {
      title: "Firmware",
      subtitle: "Image repository and recovery",
      repository: "Repository",
      recovery: "Recovery",
      uploadFirmware: "Upload Firmware",
      firmwareName: "Firmware Name",
      firmwareVersion: "Version",
      selectManufacturer: "Select manufacturer",
      noFirmware: "No firmware registered",
      selectScript: "Select script",
      selectEquipment: "Select equipment",
      executeRecovery: "Execute Recovery",
    },
    terminal: {
      title: "Terminal",
      subtitle: "Interactive SSH terminal",
      selectEquipment: "Select equipment",
      connected: "Connected",
      disconnected: "Disconnected",
      connecting: "Connecting...",
      sendCommand: "Send command",
      clearTerminal: "Clear Terminal",
      theme: "Theme",
    },
    admin: {
      title: "Administration",
      subtitle: "User and settings management",
      users: "Users",
      config: "Settings",
      backup: "Backup",
      system: "System",
      updates: "Updates",
      addUser: "New User",
      editUser: "Edit User",
      deleteUser: "Delete User",
      username: "Username",
      email: "Email",
      password: "Password",
      role: "Role",
      isAdmin: "Administrator",
      noUsers: "No users found",
      systemName: "System Name",
      serverIp: "Server IP",
      primaryColor: "Primary Color",
      logoUrl: "Logo URL",
      language: "Language",
      selectLanguage: "Select language",
      saveConfig: "Save Settings",
      themes: "System Themes",
      backgrounds: "Background",
      exportBackup: "Export Backup",
      importBackup: "Import Backup",
      systemInfo: "System Information",
      checkUpdates: "Check Updates",
      applyUpdate: "Apply Update",
      currentVersion: "Current Version",
      latestVersion: "Latest Version",
      upToDate: "System is up to date!",
      updateAvailable: "New version available!",
      permissionLevels: "Permission Levels",
      administrator: "Administrator",
      operator: "Operator",
      viewer: "Viewer",
    },
    login: {
      title: "NBM - Network Backup Manager",
      subtitle: "Sign in to continue",
      loginWithReplit: "Sign in with Replit",
      loggingIn: "Signing in...",
    },
  },
  es: {
    common: {
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      add: "Agregar",
      search: "Buscar",
      filter: "Filtrar",
      loading: "Cargando...",
      error: "Error",
      success: "Éxito",
      confirm: "Confirmar",
      back: "Volver",
      next: "Siguiente",
      close: "Cerrar",
      refresh: "Actualizar",
      download: "Descargar",
      upload: "Subir",
      view: "Ver",
      execute: "Ejecutar",
      connect: "Conectar",
      disconnect: "Desconectar",
      enabled: "Habilitado",
      disabled: "Deshabilitado",
      yes: "Sí",
      no: "No",
      all: "Todos",
      none: "Ninguno",
      actions: "Acciones",
      status: "Estado",
      name: "Nombre",
      description: "Descripción",
      date: "Fecha",
      size: "Tamaño",
      type: "Tipo",
      version: "Versión",
    },
    menu: {
      dashboard: "Panel",
      manufacturers: "Fabricantes",
      equipment: "Equipos",
      scripts: "Scripts",
      executeBackup: "Ejecutar Backup",
      backups: "Backups",
      scheduler: "Programador",
      firmware: "Firmware",
      terminal: "Terminal",
      administration: "Administración",
    },
    dashboard: {
      title: "Panel",
      subtitle: "Visión general del sistema de backup",
      totalEquipment: "Total de Equipos",
      totalBackups: "Total de Backups",
      totalScripts: "Scripts Disponibles",
      recentBackups: "Backups Recientes",
      systemStatus: "Estado del Sistema",
      noRecentBackups: "Sin backups recientes",
    },
    equipment: {
      title: "Equipos",
      subtitle: "Gestione los equipos de red",
      addEquipment: "Nuevo Equipo",
      editEquipment: "Editar Equipo",
      deleteEquipment: "Eliminar Equipo",
      equipmentName: "Nombre del Equipo",
      ipAddress: "Dirección IP",
      manufacturer: "Fabricante",
      model: "Modelo",
      username: "Usuario",
      password: "Contraseña",
      port: "Puerto",
      protocol: "Protocolo",
      enabled: "Activo",
      noEquipment: "Ningún equipo registrado",
      confirmDelete: "¿Confirma la eliminación de este equipo?",
    },
    manufacturers: {
      title: "Fabricantes",
      subtitle: "Gestione los fabricantes de equipos",
      addManufacturer: "Nuevo Fabricante",
      manufacturerName: "Nombre del Fabricante",
      noManufacturers: "Ningún fabricante registrado",
    },
    scripts: {
      title: "Scripts",
      subtitle: "Scripts de backup y actualización",
      addScript: "Nuevo Script",
      editScript: "Editar Script",
      scriptName: "Nombre del Script",
      command: "Comando",
      timeout: "Timeout (ms)",
      fileExtension: "Extensión del Archivo",
      isDefault: "Script Predeterminado",
      noScripts: "Ningún script registrado",
    },
    backups: {
      title: "Backups",
      subtitle: "Historial de backups realizados",
      backupDate: "Fecha del Backup",
      backupSize: "Tamaño",
      backupStatus: "Estado",
      viewContent: "Ver Contenido",
      downloadBackup: "Descargar Backup",
      deleteBackup: "Eliminar Backup",
      noBackups: "Ningún backup encontrado",
      statusSuccess: "Éxito",
      statusFailed: "Fallido",
      statusPending: "Pendiente",
    },
    executeBackup: {
      title: "Ejecutar Backup",
      subtitle: "Ejecute backups manualmente",
      selectEquipment: "Seleccione los equipos",
      selectScript: "Seleccione el script",
      executeNow: "Ejecutar Ahora",
      executing: "Ejecutando...",
      executionComplete: "Backup completado con éxito",
      executionFailed: "Fallo en la ejecución del backup",
    },
    scheduler: {
      title: "Programador",
      subtitle: "Políticas de backup automatizado",
      addPolicy: "Nueva Política",
      editPolicy: "Editar Política",
      policyName: "Nombre de la Política",
      frequency: "Frecuencia",
      startTime: "Hora de Inicio",
      enabled: "Activo",
      lastRun: "Última Ejecución",
      nextRun: "Próxima Ejecución",
      noPolicies: "Ninguna política configurada",
      daily: "Diario",
      weekly: "Semanal",
      monthly: "Mensual",
    },
    firmware: {
      title: "Firmware",
      subtitle: "Repositorio de imágenes y recuperación",
      repository: "Repositorio",
      recovery: "Recuperación",
      uploadFirmware: "Subir Firmware",
      firmwareName: "Nombre del Firmware",
      firmwareVersion: "Versión",
      selectManufacturer: "Seleccione el fabricante",
      noFirmware: "Ningún firmware registrado",
      selectScript: "Seleccione el script",
      selectEquipment: "Seleccione el equipo",
      executeRecovery: "Ejecutar Recuperación",
    },
    terminal: {
      title: "Terminal",
      subtitle: "Terminal SSH interactivo",
      selectEquipment: "Seleccione un equipo",
      connected: "Conectado",
      disconnected: "Desconectado",
      connecting: "Conectando...",
      sendCommand: "Enviar comando",
      clearTerminal: "Limpiar Terminal",
      theme: "Tema",
    },
    admin: {
      title: "Administración",
      subtitle: "Gestión de usuarios y configuraciones",
      users: "Usuarios",
      config: "Configuraciones",
      backup: "Backup",
      system: "Sistema",
      updates: "Actualizaciones",
      addUser: "Nuevo Usuario",
      editUser: "Editar Usuario",
      deleteUser: "Eliminar Usuario",
      username: "Usuario",
      email: "Email",
      password: "Contraseña",
      role: "Permiso",
      isAdmin: "Administrador",
      noUsers: "Ningún usuario encontrado",
      systemName: "Nombre del Sistema",
      serverIp: "IP del Servidor",
      primaryColor: "Color Principal",
      logoUrl: "URL del Logo",
      language: "Idioma",
      selectLanguage: "Seleccione el idioma",
      saveConfig: "Guardar Configuraciones",
      themes: "Temas del Sistema",
      backgrounds: "Fondo de Pantalla",
      exportBackup: "Exportar Backup",
      importBackup: "Importar Backup",
      systemInfo: "Información del Sistema",
      checkUpdates: "Verificar Actualizaciones",
      applyUpdate: "Aplicar Actualización",
      currentVersion: "Versión Actual",
      latestVersion: "Versión Disponible",
      upToDate: "¡Sistema actualizado!",
      updateAvailable: "¡Nueva versión disponible!",
      permissionLevels: "Niveles de Permiso",
      administrator: "Administrador",
      operator: "Operador",
      viewer: "Visualizador",
    },
    login: {
      title: "NBM - Network Backup Manager",
      subtitle: "Inicie sesión para continuar",
      loginWithReplit: "Iniciar con Replit",
      loggingIn: "Iniciando sesión...",
    },
  },
  fr: {
    common: {
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      add: "Ajouter",
      search: "Rechercher",
      filter: "Filtrer",
      loading: "Chargement...",
      error: "Erreur",
      success: "Succès",
      confirm: "Confirmer",
      back: "Retour",
      next: "Suivant",
      close: "Fermer",
      refresh: "Actualiser",
      download: "Télécharger",
      upload: "Envoyer",
      view: "Voir",
      execute: "Exécuter",
      connect: "Connecter",
      disconnect: "Déconnecter",
      enabled: "Activé",
      disabled: "Désactivé",
      yes: "Oui",
      no: "Non",
      all: "Tous",
      none: "Aucun",
      actions: "Actions",
      status: "Statut",
      name: "Nom",
      description: "Description",
      date: "Date",
      size: "Taille",
      type: "Type",
      version: "Version",
    },
    menu: {
      dashboard: "Tableau de bord",
      manufacturers: "Fabricants",
      equipment: "Équipements",
      scripts: "Scripts",
      executeBackup: "Exécuter Sauvegarde",
      backups: "Sauvegardes",
      scheduler: "Planificateur",
      firmware: "Firmware",
      terminal: "Terminal",
      administration: "Administration",
    },
    dashboard: {
      title: "Tableau de bord",
      subtitle: "Vue d'ensemble du système de sauvegarde",
      totalEquipment: "Total des Équipements",
      totalBackups: "Total des Sauvegardes",
      totalScripts: "Scripts Disponibles",
      recentBackups: "Sauvegardes Récentes",
      systemStatus: "État du Système",
      noRecentBackups: "Aucune sauvegarde récente",
    },
    equipment: {
      title: "Équipements",
      subtitle: "Gérez les équipements réseau",
      addEquipment: "Nouvel Équipement",
      editEquipment: "Modifier Équipement",
      deleteEquipment: "Supprimer Équipement",
      equipmentName: "Nom de l'Équipement",
      ipAddress: "Adresse IP",
      manufacturer: "Fabricant",
      model: "Modèle",
      username: "Utilisateur",
      password: "Mot de passe",
      port: "Port",
      protocol: "Protocole",
      enabled: "Actif",
      noEquipment: "Aucun équipement enregistré",
      confirmDelete: "Confirmer la suppression de cet équipement?",
    },
    manufacturers: {
      title: "Fabricants",
      subtitle: "Gérez les fabricants d'équipements",
      addManufacturer: "Nouveau Fabricant",
      manufacturerName: "Nom du Fabricant",
      noManufacturers: "Aucun fabricant enregistré",
    },
    scripts: {
      title: "Scripts",
      subtitle: "Scripts de sauvegarde et mise à jour",
      addScript: "Nouveau Script",
      editScript: "Modifier Script",
      scriptName: "Nom du Script",
      command: "Commande",
      timeout: "Délai (ms)",
      fileExtension: "Extension de Fichier",
      isDefault: "Script par Défaut",
      noScripts: "Aucun script enregistré",
    },
    backups: {
      title: "Sauvegardes",
      subtitle: "Historique des sauvegardes",
      backupDate: "Date de Sauvegarde",
      backupSize: "Taille",
      backupStatus: "Statut",
      viewContent: "Voir Contenu",
      downloadBackup: "Télécharger",
      deleteBackup: "Supprimer",
      noBackups: "Aucune sauvegarde trouvée",
      statusSuccess: "Succès",
      statusFailed: "Échoué",
      statusPending: "En attente",
    },
    executeBackup: {
      title: "Exécuter Sauvegarde",
      subtitle: "Exécutez des sauvegardes manuellement",
      selectEquipment: "Sélectionnez les équipements",
      selectScript: "Sélectionnez le script",
      executeNow: "Exécuter Maintenant",
      executing: "Exécution...",
      executionComplete: "Sauvegarde terminée avec succès",
      executionFailed: "Échec de l'exécution",
    },
    scheduler: {
      title: "Planificateur",
      subtitle: "Politiques de sauvegarde automatisée",
      addPolicy: "Nouvelle Politique",
      editPolicy: "Modifier Politique",
      policyName: "Nom de la Politique",
      frequency: "Fréquence",
      startTime: "Heure de Début",
      enabled: "Actif",
      lastRun: "Dernière Exécution",
      nextRun: "Prochaine Exécution",
      noPolicies: "Aucune politique configurée",
      daily: "Quotidien",
      weekly: "Hebdomadaire",
      monthly: "Mensuel",
    },
    firmware: {
      title: "Firmware",
      subtitle: "Dépôt d'images et récupération",
      repository: "Dépôt",
      recovery: "Récupération",
      uploadFirmware: "Envoyer Firmware",
      firmwareName: "Nom du Firmware",
      firmwareVersion: "Version",
      selectManufacturer: "Sélectionnez le fabricant",
      noFirmware: "Aucun firmware enregistré",
      selectScript: "Sélectionnez le script",
      selectEquipment: "Sélectionnez l'équipement",
      executeRecovery: "Exécuter Récupération",
    },
    terminal: {
      title: "Terminal",
      subtitle: "Terminal SSH interactif",
      selectEquipment: "Sélectionnez un équipement",
      connected: "Connecté",
      disconnected: "Déconnecté",
      connecting: "Connexion...",
      sendCommand: "Envoyer commande",
      clearTerminal: "Effacer Terminal",
      theme: "Thème",
    },
    admin: {
      title: "Administration",
      subtitle: "Gestion des utilisateurs et paramètres",
      users: "Utilisateurs",
      config: "Paramètres",
      backup: "Sauvegarde",
      system: "Système",
      updates: "Mises à jour",
      addUser: "Nouvel Utilisateur",
      editUser: "Modifier Utilisateur",
      deleteUser: "Supprimer Utilisateur",
      username: "Utilisateur",
      email: "Email",
      password: "Mot de passe",
      role: "Rôle",
      isAdmin: "Administrateur",
      noUsers: "Aucun utilisateur trouvé",
      systemName: "Nom du Système",
      serverIp: "IP du Serveur",
      primaryColor: "Couleur Principale",
      logoUrl: "URL du Logo",
      language: "Langue",
      selectLanguage: "Sélectionnez la langue",
      saveConfig: "Enregistrer",
      themes: "Thèmes du Système",
      backgrounds: "Fond d'écran",
      exportBackup: "Exporter Sauvegarde",
      importBackup: "Importer Sauvegarde",
      systemInfo: "Informations Système",
      checkUpdates: "Vérifier Mises à jour",
      applyUpdate: "Appliquer Mise à jour",
      currentVersion: "Version Actuelle",
      latestVersion: "Version Disponible",
      upToDate: "Système à jour!",
      updateAvailable: "Nouvelle version disponible!",
      permissionLevels: "Niveaux de Permission",
      administrator: "Administrateur",
      operator: "Opérateur",
      viewer: "Visualiseur",
    },
    login: {
      title: "NBM - Network Backup Manager",
      subtitle: "Connectez-vous pour continuer",
      loginWithReplit: "Se connecter avec Replit",
      loggingIn: "Connexion...",
    },
  },
  de: {
    common: {
      save: "Speichern",
      cancel: "Abbrechen",
      delete: "Löschen",
      edit: "Bearbeiten",
      add: "Hinzufügen",
      search: "Suchen",
      filter: "Filtern",
      loading: "Laden...",
      error: "Fehler",
      success: "Erfolg",
      confirm: "Bestätigen",
      back: "Zurück",
      next: "Weiter",
      close: "Schließen",
      refresh: "Aktualisieren",
      download: "Herunterladen",
      upload: "Hochladen",
      view: "Anzeigen",
      execute: "Ausführen",
      connect: "Verbinden",
      disconnect: "Trennen",
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      yes: "Ja",
      no: "Nein",
      all: "Alle",
      none: "Keine",
      actions: "Aktionen",
      status: "Status",
      name: "Name",
      description: "Beschreibung",
      date: "Datum",
      size: "Größe",
      type: "Typ",
      version: "Version",
    },
    menu: {
      dashboard: "Dashboard",
      manufacturers: "Hersteller",
      equipment: "Geräte",
      scripts: "Skripte",
      executeBackup: "Backup Ausführen",
      backups: "Backups",
      scheduler: "Planer",
      firmware: "Firmware",
      terminal: "Terminal",
      administration: "Verwaltung",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Backup-System Übersicht",
      totalEquipment: "Geräte Gesamt",
      totalBackups: "Backups Gesamt",
      totalScripts: "Verfügbare Skripte",
      recentBackups: "Aktuelle Backups",
      systemStatus: "Systemstatus",
      noRecentBackups: "Keine aktuellen Backups",
    },
    equipment: {
      title: "Geräte",
      subtitle: "Netzwerkgeräte verwalten",
      addEquipment: "Neues Gerät",
      editEquipment: "Gerät Bearbeiten",
      deleteEquipment: "Gerät Löschen",
      equipmentName: "Gerätename",
      ipAddress: "IP-Adresse",
      manufacturer: "Hersteller",
      model: "Modell",
      username: "Benutzername",
      password: "Passwort",
      port: "Port",
      protocol: "Protokoll",
      enabled: "Aktiv",
      noEquipment: "Keine Geräte registriert",
      confirmDelete: "Gerät wirklich löschen?",
    },
    manufacturers: {
      title: "Hersteller",
      subtitle: "Gerätehersteller verwalten",
      addManufacturer: "Neuer Hersteller",
      manufacturerName: "Herstellername",
      noManufacturers: "Keine Hersteller registriert",
    },
    scripts: {
      title: "Skripte",
      subtitle: "Backup- und Update-Skripte",
      addScript: "Neues Skript",
      editScript: "Skript Bearbeiten",
      scriptName: "Skriptname",
      command: "Befehl",
      timeout: "Timeout (ms)",
      fileExtension: "Dateierweiterung",
      isDefault: "Standard-Skript",
      noScripts: "Keine Skripte registriert",
    },
    backups: {
      title: "Backups",
      subtitle: "Backup-Verlauf",
      backupDate: "Backup-Datum",
      backupSize: "Größe",
      backupStatus: "Status",
      viewContent: "Inhalt Anzeigen",
      downloadBackup: "Backup Herunterladen",
      deleteBackup: "Backup Löschen",
      noBackups: "Keine Backups gefunden",
      statusSuccess: "Erfolg",
      statusFailed: "Fehlgeschlagen",
      statusPending: "Ausstehend",
    },
    executeBackup: {
      title: "Backup Ausführen",
      subtitle: "Backups manuell ausführen",
      selectEquipment: "Geräte auswählen",
      selectScript: "Skript auswählen",
      executeNow: "Jetzt Ausführen",
      executing: "Wird ausgeführt...",
      executionComplete: "Backup erfolgreich abgeschlossen",
      executionFailed: "Backup-Ausführung fehlgeschlagen",
    },
    scheduler: {
      title: "Planer",
      subtitle: "Automatisierte Backup-Richtlinien",
      addPolicy: "Neue Richtlinie",
      editPolicy: "Richtlinie Bearbeiten",
      policyName: "Richtlinienname",
      frequency: "Häufigkeit",
      startTime: "Startzeit",
      enabled: "Aktiv",
      lastRun: "Letzte Ausführung",
      nextRun: "Nächste Ausführung",
      noPolicies: "Keine Richtlinien konfiguriert",
      daily: "Täglich",
      weekly: "Wöchentlich",
      monthly: "Monatlich",
    },
    firmware: {
      title: "Firmware",
      subtitle: "Image-Repository und Wiederherstellung",
      repository: "Repository",
      recovery: "Wiederherstellung",
      uploadFirmware: "Firmware Hochladen",
      firmwareName: "Firmware-Name",
      firmwareVersion: "Version",
      selectManufacturer: "Hersteller auswählen",
      noFirmware: "Keine Firmware registriert",
      selectScript: "Skript auswählen",
      selectEquipment: "Gerät auswählen",
      executeRecovery: "Wiederherstellung Ausführen",
    },
    terminal: {
      title: "Terminal",
      subtitle: "Interaktives SSH-Terminal",
      selectEquipment: "Gerät auswählen",
      connected: "Verbunden",
      disconnected: "Getrennt",
      connecting: "Verbinden...",
      sendCommand: "Befehl senden",
      clearTerminal: "Terminal Löschen",
      theme: "Design",
    },
    admin: {
      title: "Verwaltung",
      subtitle: "Benutzer- und Einstellungsverwaltung",
      users: "Benutzer",
      config: "Einstellungen",
      backup: "Backup",
      system: "System",
      updates: "Aktualisierungen",
      addUser: "Neuer Benutzer",
      editUser: "Benutzer Bearbeiten",
      deleteUser: "Benutzer Löschen",
      username: "Benutzername",
      email: "E-Mail",
      password: "Passwort",
      role: "Rolle",
      isAdmin: "Administrator",
      noUsers: "Keine Benutzer gefunden",
      systemName: "Systemname",
      serverIp: "Server-IP",
      primaryColor: "Primärfarbe",
      logoUrl: "Logo-URL",
      language: "Sprache",
      selectLanguage: "Sprache auswählen",
      saveConfig: "Einstellungen Speichern",
      themes: "System-Designs",
      backgrounds: "Hintergrund",
      exportBackup: "Backup Exportieren",
      importBackup: "Backup Importieren",
      systemInfo: "Systeminformationen",
      checkUpdates: "Updates Prüfen",
      applyUpdate: "Update Anwenden",
      currentVersion: "Aktuelle Version",
      latestVersion: "Verfügbare Version",
      upToDate: "System ist aktuell!",
      updateAvailable: "Neue Version verfügbar!",
      permissionLevels: "Berechtigungsstufen",
      administrator: "Administrator",
      operator: "Operator",
      viewer: "Betrachter",
    },
    login: {
      title: "NBM - Network Backup Manager",
      subtitle: "Anmelden um fortzufahren",
      loginWithReplit: "Mit Replit anmelden",
      loggingIn: "Anmelden...",
    },
  },
};

export function getTranslation(lang: Language) {
  return translations[lang] || translations.pt;
}
