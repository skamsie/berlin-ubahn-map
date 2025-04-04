// custom-autocomplete.js
(function($) {
  $.widget("custom.customAutocomplete", $.ui.autocomplete, {
    _keydown: function(event) {
      // Log the key code to see if our method is triggered
      console.log("customAutocomplete _keydown triggered with keyCode:", event.keyCode);

      // Intercept the Tab key (key code 9)
      if (event.keyCode === $.ui.keyCode.TAB) {
        console.log("Tab key pressed and menu visible?", this.menu.element.is(":visible"));
        if (this.menu.element.is(":visible")) {
          var menuItems = this.menu.element.find("li:not(.ui-state-disabled)");
          console.log("Found menu items:", menuItems.length);
          // If more than one option is available, cycle through them.
          if (menuItems.length > 1) {
            event.preventDefault();
            if (this.menu.active) {
              var next = this.menu.active.next("li");
              if (!next.length) {
                next = menuItems.first();
              }
              console.log("Cycling to next item");
              this.menu.activate(event, next);
            } else {
              console.log("Activating first item");
              this.menu.activate(event, menuItems.first());
            }
            return;
          } else if (menuItems.length === 1) {
            // If there is exactly one option, select it immediately.
            event.preventDefault();
            console.log("Only one option available; selecting it.");
            this.menu.activate(event, menuItems.first());
            var item = menuItems.first().data("ui-autocomplete-item");
            this._trigger("select", event, { item: item });
            this.close();
            return;
          }
        }
      }
      // For all other keys, use the default handler.
      this._super(event);
    }
  });
})(jQuery);

// Optionally, export something if needed
export default $.custom.customAutocomplete;
