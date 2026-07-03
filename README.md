# UniBooker

Aplicación en tiempo real para reservar salas de estudio, construida con React, TypeScript y Firebase.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | [Vite](https://vite.dev/) + [React 19](https://react.dev/) |
| Lenguaje | [TypeScript](https://www.typescriptlang.org/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) |
| Backend / Auth | [Firebase](https://firebase.google.com/) (Authentication + Firestore) |
| Rutas | [React Router v6](https://reactrouter.com/) |

## Requisitos Previos

- Node.js 18+
- Un proyecto de Firebase con:
  - **Authentication** → Proveedor de **Google** habilitado
  - **Cloud Firestore** base de datos creada (en modo de prueba o con reglas personalizadas)

## Configuración Paso a Paso

### 1. Clonar e instalar

```bash
git clone <tu-url-del-repo> unibooker
cd unibooker
npm install
```

### 2. Configurar Firebase

Crea un archivo `.env` en la raíz del proyecto y agrega los valores de configuración de Firebase desde **Firebase Console → Project Settings → Web App**:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project
VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Crear índices de Firestore

Ve a **Firebase Console → Firestore → Índices** y crea dos índices compuestos en la colección `reservations`:

| Índice | Campos |
|--------|--------|
| 1 | `userId` **Ascendente**, `slotStart` **Ascendente** |
| 2 | `roomId` **Ascendente**, `slotStart` **Ascendente** |

### 4. Configurar reglas de seguridad de Firestore

Ve a **Firebase Console → Firestore → Reglas** y pega:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /reservations/{reservationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### 5. Ejecutar

```bash
npm run dev
```

Abre la URL que aparece en la terminal (generalmente `http://localhost:5173`), inicia sesión con Google y empieza a reservar salas.

### Compilar para producción

```bash
npm run build
```

La salida estará en la carpeta `dist/`, lista para desplegar en Firebase Hosting o cualquier servidor estático.

## Funcionalidades

- **Inicio de sesión con Google** — el primer ingreso crea automáticamente un documento de usuario en Firestore
- **Catálogo de salas** — cuadrícula en tiempo real con indicadores de disponibilidad verde/gris
- **Reserva por bloques horarios** — bloques de 1 hora desde las 07:00 hasta las 21:00 con un selector codificado por colores (verde = libre, gris = ocupado, amarillo = seleccionado)
- **Límite diario** — máximo 2 reservas por usuario al día, verificado del lado del servidor al confirmar
- **Cancelar reservas** — visualiza y cancela tus propias reservas desde el modal de la sala; los slots se liberan instantáneamente para otros usuarios
- **Sincronización en tiempo real** — todos los cambios se propagan mediante listeners `onSnapshot` de Firestore sin necesidad de recargar la página
- **Diseño responsivo** — la cuadrícula de Tailwind CSS se adapta desde móvil hasta escritorio

## Estructura del Proyecto

```
src/
├── firebase.ts              Inicialización de Firebase, exporta auth / db / googleProvider
├── types.ts                 Interfaces de TypeScript para Room, Reservation, AppUser
├── main.tsx                 Punto de entrada, envuelve la app en BrowserRouter
├── App.tsx                  Listener onAuthStateChanged + definición de rutas
├── index.css                Importación de Tailwind CSS v4
└── components/
    ├── Auth.tsx             Página de inicio de sesión en /login
    ├── Navbar.tsx           Barra superior con nombre de usuario y cerrar sesión
    ├── Dashboard.tsx        Cuadrícula de salas con lógica de seed, botones de tarjeta y apertura de modal
    └── BookingModal.tsx     Cuadrícula de horarios, flujo de confirmar/cancelar reserva
```
