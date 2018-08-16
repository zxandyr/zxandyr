/************************************************************
 * Focus
 *
 * A lightbox style sliding gallery made in Exhibeo.
 * Requires jQuery.
 *
 * Exhibeo: Web galleries â€? from the future!
 * http://exhibeoapp.com
 * Â© Copyright Softpress Systems â€? 2012
 *************************************************************/

(function($) {
	
	$.support.transition = (function(){ 
		var thisBody = document.body || document.documentElement;
		return thisBody.style.transition !== undefined 
				|| thisBody.style.WebkitTransition !== undefined 
				|| thisBody.style.MozTransition !== undefined 
				|| thisBody.style.MsTransition !== undefined 
				|| thisBody.style.OTransition !== undefined;
	})();
	
	// Event handling
	function on(el, evt, fn, bubble) {	
		var evts = evt.split(" "),
			i = 0,
			l = evts.length;
		// Loop through the events and check for standards or IE based even handling	
		for(i; i < l; i++) {
			evt = evts[i];
			if("addEventListener" in el) {
				try {
					el.addEventListener(evt, fn, bubble);
				} catch(e) {}
			} else if("attachEvent" in el) {
				el.attachEvent("on" + evt, fn);
			}
		}
	}
	
	function removeEvt(el, evt, fn, bubble) {	
		var evts = evt.split(" "),
			i = 0,
			l = evts.length;
		for(i; i < l; i++) {
			evt = evts[i];
			if("removeEventListener" in el) {
				try {
					el.removeEventListener(evt, fn, bubble);
				} catch(e) {}
			} 
			else if("detachEvent" in el)
				el.detachEvent("on" + evt, fn);
		}
	}
		
	$.fn.imageFocus = function(options) {
		return this.each(function() {
			// Cache the values, we'll need these later
			var $$this = $(this),
				$$id = $$this.attr("id"),
				$group = $(this).find(".image-focus a"); // fix for anchor applied to item in fw

			// Detect clicks on thumbs
			$group.click(groupOnClickHandler);
			
			function groupOnClickHandler(){
				// ===============================
				// Initialize
				window.ifIndex = 0;
				var $anchor = $(this),
					anchor = this,
					$thumb = $($anchor.children()[0]),
					div = anchor.parentNode,
					$div = $(div),
					$overlay = $("<div/>").attr("id", $$id+"-overlay").attr("class", "image-focus-overlay"),
					$body = $("body"),
					// Find other links in the same group as the thumb (these can be hidden, or visible)
					group = $group.length > 1,
					$largeImage, $caption, $hiddenFigure, $nav, $prev, $next, $figure,
					$bulletNav, $bulletUl, $bullets, bulletWidth, limit, bulletsLength,
					$beginning = $end = $back = $forward = $navWrapper = undefined,
					imageWidth, imageHeight, scaled, touch,
					transitions = $.support.transition,
					transitionEnd = "webkitTransitionEnd transitionend msTransitionEnd oTransitionEnd",
					settings = $.extend({
						/* User editable settings, passed in to the jQuery plugin. */
						"animSpeed": "200", /* The speed of the initial and end animations */
						"duration": "200", /* The duration between slides (multi-images only) */
						"spacing": "20", /* The spacing around the focused image */
						"captions": 1, /* Show captions? */
						"hideCaptions": 0, /* Autohide captions? */
						"retina": 1,
					}, options);
				
				init();
				
				function init() {
					// Create a new element to contain the image
					$figure = $("<figure/>").attr("id", $$id+"-image").attr("class", "image-focus-image"),
						// And the close control
						$close = $("<a/>").attr("id", $$id+"-close").attr("class", "image-focus-close")
							// Fixes bug in Safari 5
							.css({"webkitTransform": "translateZ(0)"}),
						// And the loader element
						$loader = $("<div/>").attr("class", "xb-loading-container").append("<div class=\"xb-loading\"><span class=\"top\"/><span class=\"right\"/><span class=\"bottom\"/><span class=\"left\"/></div>");
					
					// Append all the elements
					$body.append($overlay, $figure, $close);
					
					document.location.hash = $$id + (window.ifIndex+1);
					
					var largeImage = new Image();
					$largeImage = $(largeImage);
					
					// Place a new image inside the figure element and get the div into position
					$figure.append(largeImage, $loader)
						.css({"position": "absolute", 
							"left": $div.offset().left,
							"top": $div.offset().top,
							"width": $thumb.width(),
							"height": $thumb.height(),
							"padding": 0,
							"margin": 0,
							"overflow": "visible"
						}),
						$largeImage.hide()
							// Load the large image
							.one("load", function(){
								//$figure.before($overlay);
								$body.addClass("image-focus-viewing");
								$loader.remove();
								imageWidth = this.width / (settings.retina + 1);
								imageHeight = this.height / (settings.retina + 1);
								$(this).css({
									"width": "100%",
									"height": "100%"
								}).show();
								// and move it into the center of the viewport
								centerImage(this, settings.animSpeed, addControls);
								$(document).bind("keydown", function(e){
									if(e.which == 37)
										previous();
									else if(e.which == 39)
										next();
									else if(e.which == 27)
										close();
								});
							}).attr("src", $anchor.attr("href"));
				}
				
				// Go to index
				window.showSlide = function(index) {
					if(index < 0 || index > $group.length-1)
						return;
					
					$largeImage.unbind("load");
					
					nextImage = index;
					
					// Add a new hidden figure
					$hiddenFigure = $("<figure/>")
						.attr("class", "image-focus-hidden")
						.attr("style", $figure.attr("style"));
					$figure.before($hiddenFigure)
                         .append($loader);
					var hiddenImage = new Image();
					$hiddenFigure.append(hiddenImage);
					$largeImage = $(hiddenImage)
						// Load the large image
						.one("load", function(){
							
							$loader.remove();
							imageWidth = this.width / (settings.retina + 1);
							imageHeight = this.height / (settings.retina + 1);
							$(this).css({
								"width": "100%",
								"height": "100%"
							});
							$figure.remove();
							$figure = $hiddenFigure;
							$figure.removeClass("image-focus-hidden").attr("id", $$id+"-image").attr("class", "image-focus-image");
							if($nav)
								$nav.hide();
							window.ifIndex = nextImage;
							
							// Move it into the center of the viewport
							centerImage(this, settings.duration, addControls);
						}).attr("src", $($group[nextImage]).attr("href"));
				}
				
				// Get the width, height, left and top values of the centered image based on the size of the viewport
				function getPositions() {
					// Calculate the width, height, top and left values for the image
					// Available width and height takes into account space for navigation buttons if in a group
					var windowHeight = window.innerHeight || document.documentElement.clientHeight,
						windowWidth = window.innerWidth || document.documentElement.clientWidth,
						availableHeight = windowHeight - settings.spacing * 2 - (group ? 40 : 0),
						availableWidth = windowWidth - settings.spacing * 2 - (group ? 50 : 0),
						// Get the size of the image borders
						borderHeight = (parseInt($figure.css("borderTopWidth") + parseInt($figure.css("borderBottomWidth")))),
						borderWidth = (parseInt($figure.css("borderLeftWidth") + parseInt($figure.css("borderRightWidth")))),
						// Get the value to scale the image by (we want to divide by the largest side)
						scale = Math.max((imageHeight+borderHeight) / availableHeight, (imageWidth+borderWidth) / availableWidth),
						fittedHeight  = imageHeight / scale,
						fittedWidth = imageWidth / scale;
					
					if(fittedWidth > imageWidth || fittedHeight > imageHeight) {
						fittedWidth = imageWidth;
						fittedHeight = imageHeight;
					}
						
					return {
						"width": Math.floor(fittedWidth-borderWidth),
						"height": Math.floor(fittedHeight-borderHeight),
						"top": Math.floor(windowHeight/2 - (fittedHeight+borderHeight)/2 + $(window).scrollTop() - (group ? 20 : 0)),
						"left": Math.floor(windowWidth/2 - (fittedWidth+borderWidth)/2 + $(window).scrollLeft())
					};
				}

				// center the image in the viewport
				function centerImage(image, speed, cb) {
					scaled = getPositions();
					// Use CSS if available
					if(transitions) {
						// Are the two images exactly the same dimensions (they won't fire the transition even if so)
						var sameDimensions = image.parentNode.style.width == scaled.width + "px" &&
							image.parentNode.style.height == scaled.height + "px";
							
						image.parentNode.style.webkitTransform =
						image.parentNode.style.MozTransform =
						image.parentNode.style.msTransform =
						image.parentNode.style.OTransform =
						image.parentNode.style.transform = "translateZ(0)";
						image.parentNode.style.webkitTransitionDuration = 
						image.parentNode.style.MozTransitionDuration = 
						image.parentNode.style.msTransitionDuration = 
						image.parentNode.style.OTransitionDuration = 
						image.parentNode.style.transitionDuration = speed + "ms";
						image.parentNode.style.width = scaled.width + "px";
						image.parentNode.style.height = scaled.height + "px";
						image.parentNode.style.top = scaled.top + "px";
						image.parentNode.style.left = scaled.left + "px";
						// if the speed is set to 0 or the images are the same dimensions the transitionEnd function won't run
						if(speed == 0 || sameDimensions) {
							// Show the navigtion and fire the callback
							if($nav) {
								positionNav(scaled);
							}
							if(typeof(cb) === 'function')
								cb();
						}
						else {
							// Show the navigtion and fire the callback after the transition
							$(image.parentNode).one(transitionEnd, function() {
								$(this).unbind(transitionEnd);
								if($nav) {
									positionNav(scaled);
								}
								if(typeof(cb) === 'function')
									cb();
							});
						}
					// Fall back to JavaScript if no animations are available. 
					} else {
						$figure.animate({
							width: scaled.width,
							height: scaled.height,
							top: scaled.top,
							left: scaled.left
						}, speed/2, "swing", function() {
							if($nav)
								positionNav(scaled);
							if(typeof(cb) === 'function')
								cb();
						});
					}
				}
				
				// Show the navigation
				function positionNav(scaled) {
					$nav.css({
						"top": -parseInt($figure.css("borderTopWidth")),
						"left": -parseInt($figure.css("borderLeftWidth")),
						"width": $figure.innerWidth() + parseInt($figure.css("borderLeftWidth")) + parseInt($figure.css("borderRightWidth")),
						"height": $figure.outerHeight()
					}).show();
					// Determine if the navigation buttons should be displayed
					// Removes Previous if we're at image 0
					if(window.ifIndex > 0)
						$prev.removeClass("image-focus-hidden");
					else
						$prev.addClass("image-focus-hidden");
					// Removes Next if we're at the last image
					if(window.ifIndex < $group.length-1)
						$next.removeClass("image-focus-hidden");
					else
						$next.addClass("image-focus-hidden");	
				}
				
				// Show the captions
				function addCaptions() {
					if(settings.captions) {
						// We're using a figure element for the image so use a figcaption for the caption
						$caption = $("<figcaption/>");
						
						// Get the anchor
						var cur = $anchor;
						// If we're a group, get the current image's anchor
						if(group)
							cur = $($group[window.ifIndex]);
						// Get the title, if it exists
						if(cur.attr("title"))
							$caption.append("<h2>"+cur.attr("title")+"</h2>");
						// Get the description/caption, if it exists
						if(cur.attr("data-content"))
							$caption.append("<p>"+cur.attr("data-content")+"</p>");
						$figure.append($caption);
						// Add the listeners to the image
						if(settings.hideCaptions) {
							$figure.mouseenter(function(){
								$caption.removeClass("hide");
							}).mouseleave(function(){
								$caption.addClass("hide");
							});
						}
					}
				}
				
				// Add the controls
				function addControls() {
					if(group) {
						// Create the elements
						$nav = $("<nav/>").attr("id", $$id+"-controls"),
						$prev = $("<a/>").attr("class", "image-focus-prev").append("<b>Previous</b>").css({"width": 30 + ($figure.width()/2)}),
						$next = $("<a/>").attr("class", "image-focus-next").append("<b>Next</b>").css({"width": 30 + ($figure.width()/2)}),
						$bulletNav = $bulletNav || $("<nav/>").attr("id", $$id+"-bullet-nav").attr("class", "image-focus-bullet-nav")
							// Adding due to a bug in Safari 5
							.css({"webkitTransform": "translateZ(0)"}),
						$bulletUl = $bulletUl || $("<ul/>");
						
						// Add them to the DOM
						$nav.append($prev, $next);
						($navWrapper || $bulletNav).append($bulletUl).css({"overflow": "hidden"});
						$figure.append($nav);
						
						// Make sure we only run this code once
						if(!$bulletNav.parent().length) {
							$figure.after($bulletNav);
							for(var i = 0, l = $group.length; i < l; i++) {
								var a = "<a ontouchstart "+(window.ifIndex == i ? "class=\"selected\"" : "")+">Slide "+(i+1)+"</a>"
									li = $("<li/>").append(a);
								
								$bulletUl.append(li);
								// Store the width of the bullet
								bulletWidth = li.outerWidth(1);
								// Store the width of the other bullet controls
								extrasWidth = li.outerWidth();
							}
							// The amount we want to divide the window width by to calc how many bullets to display
							// This prevents them from spreding right the way across the window
							limit = bulletWidth + 8,
							bulletsLength = i;
								
							// If the list is wider than the window width minus a few pixels for spacing then add some controls for bullets
							if((bulletsLength * bulletWidth) > $(window).width() - (settings.spacing * 2)) {
								updateBulletsNav();
							}
						}
							
						// Set the CSS based on the image
						$nav.css({
							"position": $figure.css("position"),
							"top": -parseInt($figure.css("borderTopWidth")),
							"left": -parseInt($figure.css("borderLeftWidth")),
							"width": $figure.innerWidth() + parseInt($figure.css("borderLeftWidth")) + parseInt($figure.css("borderRightWidth")),
							"height": $figure.outerHeight()
						});
						
						// Determine if the navigation buttons should be displayed
						if(window.ifIndex > 0)
							$prev.removeClass("image-focus-hidden");
						else
							$prev.addClass("image-focus-hidden");
						if(window.ifIndex < $group.length-1)
							$next.removeClass("image-focus-hidden");
						else
							$next.addClass("image-focus-hidden");	
						
						// Add the listeners
						$prev.click(previous);
						$next.click(next);
						
						// Update the bullet navigation
						var $bulletAnchors = $bulletUl.find("a");
						$bulletAnchors.unbind("click").removeClass("selected");
						$($bulletAnchors[window.ifIndex]).addClass("selected");
						
						$bulletAnchors.not(".selected").click(function() {
							var index = $(this).parent().index();
	                        if("pushState" in history) {
								try {
	                            	history.pushState({image: index}, document.title + " â€? Image " + (index+1), window.location.pathname + "#" + $$id + (index + 1));
								} catch(e) {}
								window.showSlide($(this).parent().index());
	                        }
    	                    else {
        	                	window.showSlide($(this).parent().index());
            	            }
            	        });
					}
					// Add the captions
					addCaptions();
				}
				
				// Adds arrows to the end of the bulletnavs in case there are more bullets than fit on the screen
				function updateBulletsNav() {
					// Set the width of the list to the length of bullets * width of each bullet
					$bulletUl.css({"width": bulletsLength * bulletWidth});
					var wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
					// Create the nav wrapper
					$navWrapper = $("<div/>").css({"position": "relative", "display": "block", "float": "left", "overflow": "hidden", "width": wrapWidth}),
					$beginning = $("<div/>").attr("class", "image-focus-beginning"),
					$end = $("<div/>").attr("class", "image-focus-end"),
					$back = $("<div/>").attr("class", "image-focus-back"),
					$forward = $("<div/>").attr("class", "image-focus-forward");
					var width = Math.floor($(window).width() / limit) * bulletWidth + (extrasWidth * 4);
					$bulletNav.css({"width": width, "margin-left": ($(window).width() / 2 - width / 2) })
						.append($beginning, $back, $navWrapper.append($bulletUl), $forward, $end);
					$beginning.add($end).add($back).add($forward).append("<a/>");
					$forward.click(function() {
						wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
						$navWrapper.animate({"scrollLeft": "+=" + wrapWidth})
					});
					$back.click(function() {
						wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
						$navWrapper.animate({"scrollLeft": "-=" + wrapWidth})
					});
					$beginning.click(function() {
						wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
						$navWrapper.animate({"scrollLeft": 0})
					});
					$end.click(function() {
						wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
						$navWrapper.animate({"scrollLeft": $bulletUl.width()})
					});
				}
				
				function removeBulletsNav() {
					$bulletNav.css({"width": "100%", "margin-left": ""}).append($bulletUl.css({"width": ""}));
					$navWrapper.add($beginning).add($end).add($back).add($forward).remove();
					$navWrapper = undefined;
				}
				
				// ===============================
				
				// ===============================
				// Controls
				
				// Previous
				function previous() {
					var index = window.ifIndex - 1;
                    if("pushState" in history) {
                        if(index >= 0) {
							try {
                            	history.pushState({image: index}, document.title + " â€? Image " + (index - 1), window.location.pathname + "#" + $$id + (index - 1));
							} catch(e) {}
							window.showSlide(index);
                        }
                    }
                    else {
						document.location.hash = $$id + (index - 1);
						window.showSlide(index);
					}
					return false;
				}
				// Next
				function next() {
					var index = window.ifIndex + 1;
                    if("pushState" in history) {
                        if(index < $group.length) {
							try {
	                        	history.pushState({image: index}, document.title + " â€? Image " + (index + 1), window.location.pathname + "#" + $$id + (index + 1));
							} catch(e) {}
                         	window.showSlide(index);
                         }
                    }
                    else {
						document.location.hash = $$id + (index + 1);
						window.showSlide(index);
					}
					return false;
				}
				
				// Listeners
				on(window, "touchstart", touchStart, false);
				on(window, "touchmove", touchMove, false);
				on(window, "touchend", touchEnd, false);
				on(window, "resize", resize, false);
				on(window, "orientationchange", resize, false);
				
               /*****************************************************************
                * The following three methods are based on Brad Birdsall's excellent Swipe
                *
                * Swipe 1.0
                *
                * Brad Birdsall, Prime
                * Copyright 2011, Licensed GPL & MIT
                * http://swipejs.com
                *****************************************************************/
                         
				function touchStart(e) {
					// Get the touch start points
					touch = {
						startX: e.touches[0].pageX,
						startY: e.touches[0].pageY,
						// set initial timestamp of touch sequence
						time: Number( new Date() )	
					};
					
					// used for testing first onTouchMove event
					touch.isScrolling = undefined;
					
					// reset deltaX
					touch.deltaX = 0;
				}
				
				function touchMove(e) {
					// If we detect more than one finger or a pinch, don't do anything
					if(e.touches.length > 1 || e.scale && e.scale !== 1) {
						touch = undefined;
						return;
					}
					touch.deltaX = e.touches[0].pageX - touch.startX;
					
					// determine if scrolling test has run - one time test
					if ( typeof touch.isScrolling == 'undefined') {
						touch.isScrolling = !!( touch.isScrolling || Math.abs(touch.deltaX) < Math.abs(e.touches[0].pageY - touch.startY) );
					}
					
					// if user is not trying to scroll vertically
					if (!touch.isScrolling) {
										
						// prevent native scrolling 
						e.preventDefault();
						
						// increase resistance if first or last slide
						touch.deltaX = 
						touch.deltaX / 
						  ( (!window.ifIndex && touch.deltaX > 0               // if first slide and sliding left
							|| window.ifIndex == $group.length - 1              // or if last slide and sliding right
							&& touch.deltaX < 0                            // and if sliding at all
						  ) ?                      
						  ( Math.abs(touch.deltaX) / $(window).width() + 1 )      // determine resistance level
						  : 1 );                                          // no resistance if false
					}
					
				}
				
				function touchEnd(e) {
                         
                    // If we detect more than one finger or a pinch, don't do anything
                    if(e.touches.length > 1 || e.scale && e.scale !== 1) {
                         touch = undefined;
                         return;
                    }
                         
					// determine if slide attempt triggers next/prev slide
					var isValidSlide = 
						  Number(new Date()) - touch.time < 250      // if slide duration is less than 250ms
						  && Math.abs(touch.deltaX) > 20                   // and if slide amt is greater than 20px
						  || Math.abs(touch.deltaX) > $(window).width()/2,        // or if slide amt is greater than half the width
				
					// determine if slide attempt is past start and end
						isPastBounds = 
						  !window.ifIndex && touch.deltaX > 0                          // if first slide and slide amt is greater than 0
						  || window.ifIndex == $group.length - 1 && touch.deltaX < 0;    // or if last slide and slide amt is less than 0
				
					// if not scrolling vertically
					if (!touch.isScrolling) {
						// call slide function with slide end value based on isValidSlide and isPastBounds tests
						isValidSlide && !isPastBounds ? (touch.deltaX < 0 ? next() : previous()) : 0;
				
					}
					touch = undefined;
				}
				
				function resize(e) {
					$largeImage.each(function() {
						centerImage(this, 0);
					});
					// Resize the bullets
					// If navWrapper isn't initiated and the bullets are wider than the available space
					if(!$navWrapper) {
						if((bulletsLength * bulletWidth) > $(window).width() - (settings.spacing * 2))
							// Add the bullet controls
							updateBulletsNav();
					}
					// Otherwise, make sure things are centered
					else {
						var wrapWidth = Math.floor($(window).width() / limit) * bulletWidth;
						$navWrapper.css({"width": wrapWidth});
						// If navWrapper's wider than the list and extra controls, get rid of it and and the controls
						if(wrapWidth > ($bulletUl.width() - (extrasWidth * 4))) {
							removeBulletsNav();
							$bulletNav.css({"width": ""});
						}
						else {
							var width = Math.floor($(window).width() / limit) * bulletWidth + (extrasWidth * 4);
							$bulletNav.css({"width": width, "margin-left": ($(window).width() / 2 - width / 2) });
						}
					}
				}
				
				on(window, "popstate", historyChange, false);
				
				function historyChange(e) {
					// Get the index
					var index = window.location.hash.split("#"+$$id)[1];
					if(index === undefined)
						close();
					// Make sure it's our ID that's being targeted
					else if(RegExp($$id).test(window.location.hash))
						window.showSlide(index-1);
				}
				
				$close.one("click", close);
				
				function close() {
					// Remove the event listeners
					removeEvt(window, "touchstart", touchStart, false);
					removeEvt(window, "touchmove", touchMove, false);
					removeEvt(window, "touchend", touchEnd, false);
					removeEvt(window, "resize", resize, false);
					removeEvt(window, "popstate", historyChange, false);
                    
                    $largeImage.unbind("load");
					
					window.ifIndex = undefined;
					$body.removeClass("image-focus-viewing");
					
					// Fade the overlay away and then remove it and the large image
					// Use CSS if available
					if(transitions) {
						if($group.length) {
							$figure.unbind(transitionEnd);
							if($bulletNav && $nav)
								$bulletNav.add($nav).remove();
						}
						if($caption) {
							$caption.empty("");
						}
						$figure.css({
								"-webkit-transition-duration": settings.animSpeed+"ms",
								"-moz-transition-duration": settings.animSpeed+"ms",
								"-o-transition-duration": settings.animSpeed+"ms",
								"-ms-transition-duration": settings.animSpeed+"ms",
								"transition-duration": settings.animSpeed+"ms",
								"opacity": 0,
								"width": $thumb.width(),
								"height": $thumb.height(),
								"left": $div.offset().left + parseInt($thumb.css("borderLeftWidth")) - parseInt($figure.css("borderLeftWidth")),
								"top": $div.offset().top + parseInt($thumb.css("borderTopWidth")) - parseInt($figure.css("borderTopWidth"))
							})
							.one(transitionEnd, function() {
								$(this).unbind(transitionEnd);
								if($caption) {
									$caption.empty("");
								}
								$overlay.css({
									"-webkit-transform": "translateZ(0)", 
									"-webkit-transition": "all linear .08s", 
									"-moz-transition": "all linear .08s", 
									"-o-transition": "all linear .08s", 
									"-ms-transition": "all linear .08s", 
									"transition": "all linear .08s", 
									"opacity": "0"})
									.one(transitionEnd, function() {
										$(this).unbind(transitionEnd);
										$overlay.add($figure).remove();
									});
							});
						$(window).unbind("resize");
						$close.remove();
					}
					// Otherwise use Javascript
					else {
						$figure.stop();
						if($group.length && ($bulletNav && $nav)) {
							$bulletNav.add($nav).remove();
						}
						if($caption)
							$caption.remove();
						$figure.animate({
								"width": $thumb.width(),
								"height": $thumb.height(),
								"left": $div.offset().left, 
								"top": $div.offset().top,
								"opacity": 0
							}, settings.animSpeed/2, "swing", function(){
								$overlay.animate({
										"opacity": 0
									}, settings.animSpeed/2, "swing", function(){
										$overlay.add($figure).add(this).remove();
										$close.remove();
									});
							});
					}
					return false;
				}
				
				// ===============================
				return false;
			}
		});
	}
 
    if(!window.xb_focus)
        return;
 
    // Store args from window.xb_focus before changing its function
    var args = window.xb_focus.a;

    // Change the function of window.xb_focus to create new instances instead of loading arguments
    window.xb_focus = function(id, options) {
        window[id + "Focus"] = $("#" + id).imageFocus(options);
    }

    if(!args)
        return;

    // Load instances that were initiated before script loaded
    for(var i = 0; i < args.length; i++)
    {
        var id = args[i][0];
        var options = args[i][1];
        window[id + "Focus"] = $("#" + id).imageFocus(options);
    }
})(jQuery);