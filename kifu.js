(function($) {
    var defaults = {
        board_dimensions: 600,
        margins: 50
    };
    $.fn.kifu = function(sgf_data_or_url, options) {
        if (!options) {
            options = defaults;
        }

        if (this.length == 0 || !this[0].getContext) {
            return this;
        }

        if (typeof sgf_data_or_url === "string") {
            if (endsWith(sgf_data_or_url, ".sgf")) {
                fetchSgf(sgf_data_or_url, this, options);
            } else {
                drawSgfData(sgf_data_or_url, this, options);
            }
        } else {
            drawSgfData(this.html(), this, options);
        }
        return this;
    }

    function fetchSgf(sgf_url, jq_obj, options) {
        $.ajax({
            url: sgf_url,
            dataType: 'text',
            success: function(data) {
                drawSgfData(data, jq_obj, options);
            }
        });
    }

    function drawSgfData(sgf_data, jq_obj, options) {
        var root_mv = loadSgfData(sgf_data), ctx = jq_obj[0].getContext("2d"), 
            dim = options.board_dimensions, margins = options.margins;
        jq_obj.data("kifu_root", root_mv);

        // Vertical lines
        for (var i = 0; i <= 18; i++) {
            var dx = i/18*dim + margins;
            ctx.moveTo(dx,margins);
            ctx.lineTo(dx,dim + margins);
        }

        // Horizontal lines
        for (var i = 0; i <= 18; i++) {
            var dy = i/18*dim + margins;
            ctx.moveTo(margins,dy);
            ctx.lineTo(dim + margins,dy);
        }

        // Star points
        ctx.fillStyle = "rgb(0,0,0)";
        for (var i = 3; i <= 15; i++) {
            for (var j = 3; j <= 15; j++) {
                if (i % 6 == 3 && j % 6 == 3) {
                    var dx = i/18*dim + margins;
                    var dy = j/18*dim + margins;
                    ctx.fillRect(dx - 3, dy - 3, 6, 6);
                }
            }
        }

        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // TODO: Loop over root_mv, printing each move as it goes
        drawMove(ctx, root_mv, dim, margins);
    }

    function loadSgfData(sgf_data) {
        // Parse sgf_data and build move_stack
	var value_re = /\[[^\]]*\]/, cur_mv, last_mv, last_method, variation_stack, root_mv;
        while (sgf_data.length > 0) {
            var match_index = sgf_data.search(value_re), values, value_prefix;
            if (match_index >= 0) {
                values = value_re.exec(sgf_data);
                value_prefix = sgf_data.substr(0, match_index).replace(/\s/g, "");
                sgf_data = sgf_data.substr(match_index + values[0].length);

                // Find the current method and handle variations
                var c, method = "";
                while (value_prefix.length > 0) {
                    c = value_prefix.charAt(0);
                    value_prefix = value_prefix.substr(1);
                    if (c === "(") {
                        // Start new variation
                        if (last_mv) {
                            variation_stack.push(cur_mv);
                        }
                    } else if (c === ")") {
                        // End the current variation
                        if (variation_stack.length > 0) {
                            cur_mv = variation_stack.pop();
                        }
                    } else if (c === ";") {
                        // Start a new move
                        last_mv = cur_mv;
                        cur_mv = new Move();
                        root_mv = root_mv? root_mv : cur_mv;
                        if (last_mv) {
                            last_mv.addNextMove(cur_mv);
                        }
                    } else {
                        method += c;
                    }
                }
                method = method.trim();
                if (method) {
                    last_method = method;
                } else {
                    method = last_method;
                }

                // Populate current move
                if (cur_mv) {
                    if (cur_mv.meta.indexOf(method) < 0) {
                        cur_mv.meta += " " + method;
                        cur_mv.meta = cur_mv.meta.trim();
                    }
                    value = values[0].replace(/[\]\[]/g, "");
                    if (method == "B" || method == "W") {
                        cur_mv.color = method;
                        cur_mv.position = value;
                    } else if (method == "C") {
                        cur_mv.comment = value;
                    } else if (method == "AW") {
                        cur_mv.aw.push(value);
                    } else if (method == "AB") {
                        cur_mv.ab.push(value);
                    }
                }
            } else {
                value_prefix = sgf_data;
                sgf_data = "";
            }
        }
        return root_mv;
    }

    function drawMove(ctx, move, board_dim, margins) {
        // TODO: Draw current move based on turn and position

        // Draw static position, if any
        for (var i = 0; i < move.ab.length; i++) {
            drawPosition(ctx, board_dim, "b", move.ab[i], margins);
        }
        for (var i = 0; i < move.aw.length; i++) {
            drawPosition(ctx, board_dim, "w", move.aw[i], margins);
        }
    }

    function drawPosition(ctx, board_dim, color, position, margin) {
        var x = (position.charCodeAt(0) - 97) / 18 * board_dim + margin;
        var y = (position.charCodeAt(1) - 97) / 18 * board_dim + margin;
        ctx.beginPath();
        ctx.arc(x, y, board_dim / (18 * 3), 0, 2 * Math.PI);
        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.stroke();
        if (color == "b") {
            ctx.fillStyle = "rgb(0,0,0)";
        } else {
            ctx.fillStyle = "rgb(255,255,255)";
        }
        ctx.fill();
    }

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    function Move() {
        var move = this;
        this.color = "";
        this.next_move = null;
        this.comment = "";
        this.meta = "";
        this.position = "";
        this.aw = [];
        this.ab = [];

        this.addNextMove = function(mv) {
            if (move.next_move == null) {
                move.next_move = mv;
            } else if (move.next_move instanceof Move) {
                move.next_move = [move.next_move, mv];
            } else {
                move.next_move.push(mv);
            }
        }

        this.tostr = function(t) {
            var tp = "";
            for (var i = 0; i < t; i++) {
                tp += "\t";
            }
            s = tp + "[move=" + this.meta + "]\n";
            if (this.next_move == null) return s;
            if (this.next_move instanceof Move) {
                s += this.next_move.tostr(t);
            } else {
                for (var i = 0; i < this.next_move.length; i++) {
                    s += tp + "var:\n";
                    s += this.next_move[i].tostr(t + 1);
                }
            }
            return s;
        }
    }
})(jQuery);
