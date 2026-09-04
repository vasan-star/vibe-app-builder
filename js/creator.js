/*
  QV37 AI
  CREATOR / ADMIN MODE

  Creator-only control system.

  Security:
  - The browser does NOT decide who the creator is.
  - /api/me verifies the logged-in account on the server.
  - Creator identity remains on the server / Vercel Environment Variables.
*/

(function () {

  "use strict";


  /*
    CREATOR STATE
  */

  let creatorMode = false;
  let creatorPanel = null;
  let creatorButton = null;


  /*
    CHECK CREATOR STATUS
  */

  async function checkQV37Creator(session) {

    hideCreatorUI();

    if (!session) {
      return false;
    }

    try {

      const response =
        await fetch(
          "/api/me",
          {
            method: "GET",

            headers: {
              Authorization:
                "Bearer " +
                session.access_token
            }
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        console.error(
          "Creator verification failed:",
          data.error
        );

        return false;
      }


      if (data.creator === true) {

        creatorMode = true;

        createCreatorUI();

        return true;
      }


      return false;


    } catch (error) {

      console.error(
        "Creator verification error:",
        error
      );

      return false;
    }
  }


  /*
    CREATE CREATOR BUTTON
  */

  function createCreatorButton() {

    if (
      document.getElementById(
        "qv37-creator-button"
      )
    ) {

      creatorButton =
        document.getElementById(
          "qv37-creator-button"
        );

      return;

    }


    creatorButton =
      document.createElement("button");


    creatorButton.id =
      "qv37-creator-button";


    creatorButton.type =
      "button";


    creatorButton.textContent =
      "⚡ Creator";


    creatorButton.style.cssText = `
      position: fixed;
      top: 84px;
      right: 20px;
      z-index: 9998;
      background: #10b981;
      color: #000;
      border: 0;
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 8px 25px rgba(0,0,0,.35);
    `;


    document.body.appendChild(
      creatorButton
    );


    creatorButton.addEventListener(
      "click",
      function () {

        toggleCreatorPanel();

      }
    );

  }


  /*
    CREATE CREATOR PANEL
  */

  function createCreatorPanel() {

    if (
      document.getElementById(
        "qv37-creator-panel"
      )
    ) {

      creatorPanel =
        document.getElementById(
          "qv37-creator-panel"
        );

      return;

    }


    creatorPanel =
      document.createElement("div");


    creatorPanel.id =
      "qv37-creator-panel";


    creatorPanel.style.cssText = `
      position: fixed;
      top: 125px;
      right: 20px;
      width: 350px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 150px);
      overflow-y: auto;
      z-index: 9997;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 18px;
      padding: 18px;
      color: #fff;
      box-shadow: 0 25px 70px rgba(0,0,0,.55);
      display: none;
    `;


    creatorPanel.innerHTML = `

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:18px;
      ">

        <div>

          <div style="
            font-size:18px;
            font-weight:900;
          ">
            ⚡ QV37 Creator
          </div>

          <div style="
            margin-top:3px;
            color:#71717a;
            font-size:12px;
          ">
            Creator control center
          </div>

        </div>


        <button
          id="qv37-creator-close"
          type="button"
          style="
            background:none;
            border:0;
            color:#71717a;
            font-size:22px;
            cursor:pointer;
          "
        >
          ×
        </button>

      </div>


      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      ">

        <button
          id="qv37-creator-dashboard"
          type="button"
          class="qv37-creator-option"
        >
          📊 Dashboard
        </button>


        <button
          id="qv37-creator-users"
          type="button"
          class="qv37-creator-option"
        >
          👥 Users
        </button>


        <button
          id="qv37-creator-apps"
          type="button"
          class="qv37-creator-option"
        >
          📱 Apps
        </button>


        <button
          id="qv37-creator-credits"
          type="button"
          class="qv37-creator-option"
        >
          💳 Credits
        </button>


        <button
          id="qv37-creator-analytics"
          type="button"
          class="qv37-creator-option"
        >
          📈 Analytics
        </button>


        <button
          id="qv37-creator-settings"
          type="button"
          class="qv37-creator-option"
        >
          ⚙️ Settings
        </button>

      </div>


      <div
        id="qv37-creator-output"
        style="
          margin-top:15px;
          padding:14px;
          border-radius:12px;
          background:#09090b;
          border:1px solid #27272a;
          color:#a1a1aa;
          font-size:13px;
          line-height:1.6;
        "
      >
        Creator Mode is active.
      </div>

    `;


    document.body.appendChild(
      creatorPanel
    );


    addCreatorPanelStyles();

    connectCreatorPanelButtons();

  }


  /*
    CREATOR PANEL STYLES
  */

  function addCreatorPanelStyles() {

    if (
      document.getElementById(
        "qv37-creator-styles"
      )
    ) {

      return;

    }


    const style =
      document.createElement("style");


    style.id =
      "qv37-creator-styles";


    style.textContent = `

      .qv37-creator-option {
        background:#09090b;
        color:#e4e4e7;
        border:1px solid #27272a;
        border-radius:10px;
        padding:12px 8px;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
        transition:.2s;
      }

      .qv37-creator-option:hover {
        background:#27272a;
        border-color:#52525b;
      }

    `;


    document.head.appendChild(
      style
    );

  }


  /*
    CONNECT PANEL BUTTONS
  */

  function connectCreatorPanelButtons() {

    const closeButton =
      document.getElementById(
        "qv37-creator-close"
      );


    if (closeButton) {

      closeButton.addEventListener(
        "click",
        function () {

          hideCreatorPanel();

        }
      );

    }


    const dashboard =
      document.getElementById(
        "qv37-creator-dashboard"
      );


    if (dashboard) {

      dashboard.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              Creator Dashboard
            </strong>
            <br><br>
            Dashboard system is ready.
            <br>
            User statistics, app statistics and credit statistics can be connected next.
            `
          );

        }
      );

    }


    const users =
      document.getElementById(
        "qv37-creator-users"
      );


    if (users) {

      users.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              User Management
            </strong>
            <br><br>
            User management interface is ready.
            <br>
            We can connect secure user data from the backend next.
            `
          );

        }
      );

    }


    const apps =
      document.getElementById(
        "qv37-creator-apps"
      );


    if (apps) {

      apps.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              Generated Apps
            </strong>
            <br><br>
            Generated application management is ready.
            <br>
            Saved apps, app owners and app history can be connected next.
            `
          );

        }
      );

    }


    const credits =
      document.getElementById(
        "qv37-creator-credits"
      );


    if (credits) {

      credits.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              Credit Management
            </strong>
            <br><br>
            Credit management interface is ready.
            <br>
            Credit controls should be connected to secure backend operations.
            `
          );

        }
      );

    }


    const analytics =
      document.getElementById(
        "qv37-creator-analytics"
      );


    if (analytics) {

      analytics.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              Analytics
            </strong>
            <br><br>
            Analytics section is ready.
            <br>
            AI generations, users, credits and application statistics can be added next.
            `
          );

        }
      );

    }


    const settings =
      document.getElementById(
        "qv37-creator-settings"
      );


    if (settings) {

      settings.addEventListener(
        "click",
        function () {

          showCreatorOutput(
            `
            <strong style="color:#10b981;">
              Creator Settings
            </strong>
            <br><br>
            Creator settings interface is ready.
            <br>
            Secure settings will be connected through the backend.
            `
          );

        }
      );

    }

  }


  /*
    SHOW OUTPUT
  */

  function showCreatorOutput(message) {

    const output =
      document.getElementById(
        "qv37-creator-output"
      );


    if (!output) {

      return;

    }


    output.innerHTML =
      message;

  }


  /*
    SHOW CREATOR UI
  */

  function createCreatorUI() {

    if (!creatorMode) {

      return;

    }


    createCreatorButton();

    createCreatorPanel();

  }


  /*
    TOGGLE PANEL
  */

  function toggleCreatorPanel() {

    if (!creatorPanel) {

      return;

    }


    if (
      creatorPanel.style.display ===
      "none"
    ) {

      creatorPanel.style.display =
        "block";

    } else {

      creatorPanel.style.display =
        "none";

    }

  }


  /*
    HIDE PANEL
  */

  function hideCreatorPanel() {

    if (creatorPanel) {

      creatorPanel.style.display =
        "none";

    }

  }


  /*
    HIDE ALL CREATOR UI
  */

  function hideCreatorUI() {

    creatorMode = false;

    hideCreatorPanel();


    if (creatorButton) {

      creatorButton.remove();

      creatorButton = null;

    }


    if (creatorPanel) {

      creatorPanel.remove();

      creatorPanel = null;

    }

  }


  /*
    PUBLIC CREATOR API
  */

  window.QV37Creator = {

    check:
      checkQV37Creator,

    isCreator:
      function () {

        return creatorMode;

      },

    hide:
      hideCreatorUI,

    show:
      function () {

        if (creatorMode) {

          createCreatorUI();

        }

      }

  };


  /*
    INITIAL STATE
  */

  hideCreatorUI();


})();
