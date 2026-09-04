/*
  QV37 AI
  CREATOR / ADMIN MODE

  This module handles creator-only UI.

  Security:
  - The browser does NOT decide who the creator is.
  - /api/me verifies the logged-in account on the server.
  - Creator email stays inside Vercel Environment Variables.
*/

(function () {

  "use strict";


  /*
    CREATOR STATE
  */

  let creatorMode = false;


  /*
    GET ELEMENTS
  */

  function getCreatorBadge() {
    return document.getElementById("creator-badge");
  }

  function getCreditDisplay() {
    return document.getElementById("credit-display");
  }


  /*
    HIDE CREATOR UI
  */

  function hideCreatorUI() {

    const badge =
      getCreatorBadge();

    const creditDisplay =
      getCreditDisplay();

    if (badge) {
      badge.classList.add("hidden");
    }

    if (creditDisplay) {
      creditDisplay.classList.remove("hidden");
    }

    creatorMode = false;
  }


  /*
    SHOW CREATOR UI
  */

  function showCreatorUI() {

    const badge =
      getCreatorBadge();

    const creditDisplay =
      getCreditDisplay();

    if (badge) {
      badge.classList.remove("hidden");
    }

    if (creditDisplay) {
      creditDisplay.classList.add("hidden");
    }

    creatorMode = true;

    console.log(
      "QV37 Creator Mode enabled."
    );
  }


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

        showCreatorUI();

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
      showCreatorUI

  };


  /*
    INITIAL STATE
  */

  hideCreatorUI();


})();
