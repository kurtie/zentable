/**
    Zentable v1.0.4 Developed by Zentense (Apr'13)
    Copyright (c) 2009 Jose R. Cabanes
    Dual licensed under the MIT and GPL licenses.
    Needs jquery.timers, Draggable from jquery-ui and jquery.mousewheel
 */

(function($) {
    
    $.fn.zentable= function(options) {
        var opts = $.extend({}, $.fn.zentable.defaults, options);        

        if (options=='get')
            return  $.fn.zentable.tables[this.get(0).id];                
        
        if (options=='focus') {
            $.fn.zentable.focus.push(this.get(0).id);
            $.fn.zentable.resize();
            return;
        }

        if (!$.fn.zentable.eventsHooked) {
            $(document).keydown($.fn.zentable.keyDown);
            $(window).resize($.fn.zentable.resize);            
            $.fn.zentable.eventsHooked = true;
        }        
        
        return this.each(function() {    
            $this = $(this);
            $(this).empty();
            var instance= new $.fn.zentable.Zentable(this.id, opts);
            $.fn.zentable.tables[this.id]= instance;             
            $.fn.zentable.focus.push(this.id);
            
            if (opts.onclick)
                instance.onclick= opts.onclick;

            if (opts.onedit) 
                instance.editCallback= opts.onedit;
            if (opts.data instanceof Array) {
                var data= new $.fn.zentable.ArrayDataSource(opts.data);
                data.setCols(opts.cols);
                instance.setDataSource(data);
                instance.dataLoaded();
            } else 
            if (opts.data!=undefined) {
                var data= new $.fn.zentable.AJAXDataSource(opts.data, instance.getRows(),opts.csvMaxDump);
                instance.setDataSource(data);
                data.setFilters(opts.filters);
                data.setOrder(opts.order);

                for(i=0; i<opts.filters.length; i++) {    
                    var f= $("#"+opts.filters[i]);
                    if (f.length==0) {
                        f= $("input[name="+opts.filters[i]+"]");
                        if (f.length==0)
                            f= $("select[name="+opts.filters[i]+"]");
                    }
                    if(f.is("input[type=text]")) {
//                    switch(f.attr("type")) {
//                    case "text":
                      	f.keyup(function() { $(this).oneTime(500, 'filter', instance.data.refresh); });
//                        break;
//                    case "select-one":
//                    case "checkbox":
                    } else if (f.is("input[type=text]") || f.is("input[type=checkbox]") || f.is("select"))
                        f.change(function() { instance.data.refresh(); });              
//                    }
                                                                        
                }
                var scroll= instance.getScroll();
                scroll.setCurrentRow(opts.startRow);
                data.refresh();
            }


        });

    };

    $.fn.zentable.defaults= {        
        cols:[],
        data: undefined,
        hideIfEmpty: true,
        filters: [],
        onclick: false,
        onedit: false,
        order: '',
        rows: 10,        
        stylesInRows: false,
        totalsRow: false,
        csv: false,
        csvMaxDump: 1000,
        startRow: 0
    };
    
    $.fn.zentable.tables= {};
    $.fn.zentable.Focus= function() {
        var array= [];
        var idx= 0;

        this.get = function() { return array[idx-1]; }
        this.push= function(elem) { array[idx++]= elem; }
        this.pop= function() { return array[--idx]; }
    };
    $.fn.zentable.focus= new $.fn.zentable.Focus();

    
    $.fn.zentable.keyDown= function(e) {
        var instance= $.fn.zentable.tables[$.fn.zentable.focus.get()];
        return instance.keyDown(e);
    };

    $.fn.zentable.resize= function() {
        var instance= $.fn.zentable.tables[$.fn.zentable.focus.get()];        
        instance.resizeColumns(true);        
    };

    $.fn.zentable.eventsHooked= false;
    $.fn.zentable.focus[$.fn.zentable.focus.length]= null;

    /*********************************************************************************************
                                        ZENTABLE
    *********************************************************************************************/
    $.fn.zentable.Zentable= function(name, opts) {
        this.data= new $.fn.zentable.ArrayDataSource([]);
        var rows= opts.rows;
        var cols= 1;
        var columns= [ {name:'Empty'}];
        var colWidth= new Array();
        var table, field, scroll, overlay, tip, status;
        var instance= this;
        var needsScroll= false;
        var dragStart, colWidthStart, usedStart;
        var cells= new Array();
        var editing= null;

        this.setDataSource= function(source) {
            columns= null;
            this.data= source;   
            source.setListener(this);
            scroll.setCurrentRow(0);
            if (opts.hideIfEmpty && source.isDataReady() && source.getSize()==0)
                table.hide();
        };

        function makeEditable() {
            table.find(".row .cell:not(.noteditable)").click(function() {
                editing= $(this);
                editing.parent().children().removeClass("hover");
                overlay.fadeTo(0,0);            
                overlay.show();
                overlay.fadeTo(500, 0.4);       
                field.css("top", editing.position().top);
                field.css("left", editing.position().left);
                var input= field.children().eq(0);
                input.width(editing.width());
                input.get(0).value= editing.html();
                field.fadeIn(250, function() { input.focus(); });
            });
            
        };

        this.endEdit= function() {
            editing= null;
            field.fadeOut(250);
            overlay.fadeOut(500);
        };

        function getWidth() {
            return table.width() - 9 * cols - (instance.data.getSize()>rows ? 20 : 0);    // padding*2 + 1
        };

        this.setColumnWidths= function(w) {
            colWidth= w;
            totColWidth= 0;
            tot= getWidth();

            for (i=0; i<cols; i++)
                if (columns[i].width!=null)
                    tot -= columns[i].width;

            for (i=0; i<cols; i++)
                if (columns[i].width==null)
                    totColWidth += w[i];

            for (i=0; i<cols; i++)
                colWidth[i]= columns[i].width!=null  ? columns[i].width : colWidth[i]*tot/totColWidth;

            this.resizeColumns();
        };

        this.refresh= function() {
            this.data.refresh();
            needsScroll= true;
        };

        this.getRows= function() { return rows; };
	
	this.getTotalRows=function() {
	    return scroll.getTotalRows();
	}

    this.dataLoaded= function() {
            table.show();
            var size= this.data.getSize();

            if (size > rows) 
                scroll.get().show();
            else {                
                if (scroll.get().css("display") == 'block') {
                    scroll.get().hide();   
                    this.setColumnWidths(colWidth);
                } else
                    scroll.get().hide();
            }

            if (columns==null) {
                columns= this.data.cols;  
                cols= columns.length;                
                renderCells();
                
                // hide / show rows when needed. This was done outside this condition, but weirdly enough, the autoWidth was not getting the right width
                table.find(".row").each(function(i) {
                    $(this).css("display", size>i ? "block" : "none"); 
                });              
                autoWidth();               
            } else {
                table.find(".row").each(function(i) {
                    $(this).css("display", size>i ? "block" : "none"); 
                });
            }

//            var y= table.offset().top + 42;
//            status.draggable('option', 'containment', [0, y, 0, Math.min(y+size*table.find(".row").height(), $(window).height()-36)] );

            scroll.setTotalRows(size);
            if (scroll.getCurrentRow() + rows > size)
                scroll.move(size - scroll.getCurrentRow() - rows);
            else
                scroll.refresh(); 

            if (opts.hideIfEmpty) {
                if (this.data.getSize()==0)
                    table.hide();
                else
                    table.show();
            }

            needsScroll= true;

        };

        function autoWidth() {
            var widths= new Array();
            var lim= Math.min(rows, instance.data.getSize());
            if (lim==0) {
                for (j=0; j<cols; j++)
                    widths[j]= 1;
            } else {
                for (i=0; i<lim; i++) {
                    var row= instance.data.getRow(i);                   
                    for (j=0; j<cols; j++) {                    
                        var len= ($("<span>"+row[j]+"</span>").text()).length + 5;
                        if (widths[j]==undefined || len>widths[j]) 
                            widths[j]= len;
                    }
                }
            }
            instance.setColumnWidths(widths);
        };

        this.setLoading= function(bool) { 
            var l= status.find("#loading");
            if (bool) l.show();
            else l.fadeOut(250);
        };


        function renderHTML() {
            table= $("#"+name);
            table.height("auto");

            table.append('<div class="overlay"></div>');
            overlay= table.find(".overlay");
            table.append('<div class="tip"></div>');        
            tip= table.find(".tip");        
            table.append('<div class="field"><input type="text"></div>');
            field= table.find(".field");

            table.append('<div id="'+name+'_scroll" class="scroll"></div>');
            scroll= new $.fn.zentable.Scrollbar(name, rows, instance);   
            
            table.append('<div class="headerrow"></div>');
            row= table.find(".headerrow");
            table.append('<div class="rowcontainer"></div>');

            renderCells();
            table.append('<div class="status"><div id="message"></div><div id="csv">CSV</div><div id="loading">LOADING...</div></div>');
            table.append('<div id="zt_csvwin_'+name+'" class="zt_csvwin"><div id="header">Zentable CSV<div id="close">X</div><div id="select">Select all</div></div><div id="csv"></div></div>');
                
            status= table.find(".status");
            instance.setColumnWidths([1]);
                                    
            status.find("#csv").click(function() {
            $("#zt_csvwin_"+name).slideDown(1000);
                instance.data.dumpCSV($("#zt_csvwin_"+name+" #csv"));
        });            
        status.find("#csv").toggle(opts.csv);
            
        $("#zt_csvwin_"+name+" #close").click(function() { $("#zt_csvwin_"+name).fadeOut(500); });
        $("#zt_csvwin_"+name+" #select").click(function() {            
            if(window.getSelection) { // FF, Safari, Opera
            var sel = window.getSelection();
                    var range = document.createRange();
                range.selectNode($("#zt_csvwin_"+name+" #csv").get(0));
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else { // IE
            document.selection.empty();
            var range = document.body.createTextRange();
            range.moveToElementText($("#zt_csvwin_"+name+" #csv").get(0));
            range.select();
            }
            });
        };


        function renderCells() {
            var header= table.find(".headerrow");
            header.empty();
            for (j=0; j<cols; j++) {
                if (columns[j].hidden==undefined) {
                    header.append('<div class="header col'+j+(columns[j].orderable ? " orderable" : "")+'">'+columns[j].name+'</div>');
                    if (j>0)
                        header.append('<div id="'+name+'_'+j+'RS" ident="'+j+'" class="resize"></div>');
                }
            }

            table.find(".orderable").click(function(){
                for (j=0; j<cols; j++)
                    if ($(this).hasClass("col"+j))
                        instance.data.sort(j);
            });

            var container= table.find(".rowcontainer");
            container.empty();

            for (i=0; i< rows; i++) 
                container.append('<div class="row" row="'+i+'"></div>');

            if (opts.totalsRow) {
                container.append('<div class="totals"></div>');
                for (j=0; j< cols; j++)
                   table.find(".totals").append('<div class="col'+j+'"></div>');
            }
                
            container.find(".row").each(function(i) {
                cells[i]= new Array();

                for (j=0; j< cols; j++) {
                    $(this).append('<div class="cell col'+j+' '+columns[j].clss+(!columns[j].editable ? ' noteditable': '')+(columns[j].html ? " html" : "")+'"></div>');
                    cells[i][j]= $(this).find(".cell:last");
                }
                
                $(this).hover(
                    function() { $(this).children().addClass("hover"); },
                    function() { $(this).children().removeClass("hover"); }
                );

            });


            table.find(".resize").draggable({ 
                axis:'x',
                drag: function(event, ui) { instance.resizeColumn(event, ui); },
                start: function(event, ui) { instance.startResizeColumn(event, ui); },
                stop: function(event, ui) { instance.resizeColumns(); }
            });

            table.find(".row .cell, .headerrow .header").hover( 
                function() { 
                    instance.hideTip();            
                    var cell= $(this);
                    if(!cell.hasClass("html"))
                        table.oneTime(1000, 'tip', function() { instance.showTip(cell); } ); 
                },
                function() { table.stopTime('tip'); }
            );

            if (instance.onclick)
                table.find(".row .noteditable").click(function() {
                    for (x=0; x<cols;x++)
                        if ($(this).hasClass("col"+x)) 
                            break;
                    instance.onclick($(this), x, $(this).parent().attr("row")*1 + scroll.getCurrentRow() );
                });

            if (instance.editCallback)
                makeEditable();

            for (j=0; j<cols; j++) {
                if (columns[j].hidden!=undefined) {
                    columns[j].width= -9;
                    table.find(".col"+j).hide();
                }
            }
        };


        this.startResizeColumn= function(event, ui) {
            idx= ui.helper.attr("ident") - 1;
            // Kludge for hidden columns
            while (columns[idx].hidden!=undefined)
                idx--;			
            colWidthStart= table.find(".row .col"+idx).width();
            dragStart= ui.helper.offset().left;
        };


        this.resizeColumn= function(event, ui) {
            idx= ui.helper.attr("ident") - 1;

	    // Kludge for hidden columns
	    while (columns[idx].hidden!=undefined)
		idx--;	
            width= colWidthStart + ui.helper.offset().left - dragStart;
            if (width<20)
                return;

            var used= 0;
            for (i= idx+1; i<cols; i++)
                used += colWidth[i];

            var avail= getWidth() - width;
            for (i=idx-1; i>=0; i--)
                avail -= colWidth[i];

            for (i= idx+1; i<cols; i++) {
                if (columns[i].hidden==undefined && colWidth[i]/used * avail<20)
                    return;
            }
            
            colWidth[idx]= width;
            for (i= idx+1; i<cols; i++) 	
		if (columns[i].hidden==undefined)
                    colWidth[i]= parseInt(colWidth[i]/used * avail);
            this.resizeColumns();
        };


        this.resizeColumns= function(recalculate) {
            totalWidth= getWidth();

            if (recalculate) {
                tmp=0;
                for (i=0; i<cols; i++)
                    tmp += (colWidth[i]*1);
                 for (i=0; i<cols; i++)
                    colWidth[i] *= totalWidth/tmp;
            }
            tmp= 0;
            for (j=0; j<cols-1; j++) {
                w = parseInt(colWidth[j]);
                table.find("* .col" + j).width(w);
                $("#" + name + "_" + j + "RS").css("left", tmp + (9 * j) - 4 + 'px');
                tmp += w;
            }
            $("#"+name+"_"+j+"RS").css("left", tmp+(9*j)-4+'px');
            table.find("* .col"+j).width(totalWidth - tmp - 0.5);    
        };


        this.scrollChanged= function() {
            needsScroll= true;
        };

        this.getScroll= function() {
            return scroll;        
        };

        this.scroller= function() {
            if (needsScroll) {           
                needsScroll= false;
                var pos= scroll.getCurrentRow();

                for (i=0; i<rows; i++) {
                    var row= instance.data.getRow(i+pos);                
                    for (j=0; j<cols; j++) 
                        cells[i][j].html(row ? ""+row[j] : '');
                }

                if (opts.totalsRow) {
                    table.find(".totals div").each(function(i) {
                        $(this).html(instance.data.totals[i]);
                    });
                }

                if (opts.stylesInRows) {
                    table.find(".row").each(function(i) {
                        $(this).removeClass();
                        $(this).addClass("row "+ instance.data.getRowClass(i + pos));
                    });
                }

                var total= scroll.getTotalRows();
                status.find("#message").html("Viewing "+(rows>total ? total : rows)+" of "+total+" rows. Starting at row "+scroll.getCurrentRow());
            }
        };
        
        this.showTip= function(cell) {
            tip.html(cell.html());
            if (tip.width() > cell.width()*0.9) {;
                tip.css("top", cell.position().top);
                tip.css("left", cell.position().left);
                tip.fadeIn(250);            
            }        
        };

        this.hideTip= function() {
            tip.fadeOut(400, function() { tip.css("left", 0); } );
        };

        this.verticalResize= function() {
            var h= table.find(".row").height();
            rows= parseInt((status.position().top-23 - (opts.totalsRow ? h : 0) ) / h);

            table.find(".scroll").empty();        
            scroll= new $.fn.zentable.Scrollbar(name, rows, instance);
            scroll.setTotalRows(this.data.getSize());

            renderCells();
            this.resizeColumns();
            needsScroll= true;
            status.css("top", "");
            table.css("height", "");
        };


        this.setOrderSign= function(col, ascending) {
            table.find(".ascending,.descending").remove();
            var hdr= table.find(".headerrow .col"+col);
            hdr.append('<div class="'+(ascending ? 'ascending' : 'descending')+'"></div>');
        };

        renderHTML();
        table.find(".row:gt(0)").css("display", "none");            

        this.keyDown= function(e) {
            if (editing!=null) {
                switch(e.keyCode) {
                    case 13: 
                        for (x=0; x<cols;x++)
                            if (editing.hasClass("col"+x)) 
                                break;
                        y= editing.parent().attr("row")*1;
                        var val= field.children().eq(0).get(0).value;
                        var c= columns[x].id==null ? columns[x].name : columns[x].id;
                        instance.editCallback(editing, val, c, y + scroll.getCurrentRow() );
                    case 27: instance.endEdit(); break;
                }           
                return true;
            }

        // Allow other elements use keys 
            if (e.target!=undefined && e.target.type!=undefined && e.target.type.length>0)
                return true;
/* YUK!!! IE 7- has no support to HTMLInputElement
        if(e.target!=undefined && (e.target instanceof HTMLInputElement || 
           e.target instanceof HTMLTextAreaElement ||
           e.target instanceof HTMLSelectElement) )
           return true;
*/                        
            switch(e.keyCode) {
                case 38: scroll.up(); break;
                case 40: scroll.down(); break;
                case 33: scroll.pageUp(); break;
                case 34: scroll.pageDown(); break;
                case 36: scroll.first(); break;
                case 35: scroll.last(); break;
                default: return true;
            }
            return false;            
        };

        $(document).ready(function() {

            table.mouseleave(function() { instance.hideTip();});
      
//            $(document).keydown(keyDown);
            
            table.mousewheel(function(event, delta) {
                if (editing!=null)
                    return true;
                if (delta>0)
                    scroll.move(-5);
                else
                    scroll.move(5);
                return false;           
            });

            table.everyTime(60, instance.scroller);           
            overlay.click(instance.endEdit); 

            status.draggable({
                axis:'y',
                grid: [0, 21],
                //revert: true,
                drag: function(event, ui) { table.height(status.position().top + status.height()); },
                stop: function(event, ui) { instance.verticalResize(); }
            });
        });
    };

    /*********************************************************************************************
                                        SCROLLBAR
    *********************************************************************************************/
    $.fn.zentable.Scrollbar= function(name, rows, listener) {
        var widget= $("#"+name+"_scroll");
        widget.append('<div class="buttonup"></div>');
        widget.append('<div class="drag_container"><div class="drag"></div></div>');
        widget.append('<div class="buttondn"></div>'); 
        
        var totalRows= 0;
        var drag= widget.find(".drag");
        var instance= this; 
        var currentRow= 0;
        
        function getHeight() { return widget.height()-45; };
        
        this.get= function() { return widget; };
        this.getCurrentRow= function() { return currentRow; };
        this.setCurrentRow= function(row) { currentRow= row; };

        this.getTotalRows= function() { return totalRows; };
        this.setTotalRows= function(total) {
            totalRows= total;
            widget.find(".drag_container").height(getHeight());
            var h= getHeight()*rows / totalRows;
            h= !isFinite(h) ? getHeight() : h;                
            drag.height(h<25 ? 25 : h);
        };
        
        this.drag= function(event, ui) {
            var y= drag.position().top;

            var row= parseInt((totalRows - rows) * y / (getHeight() - drag.height()-2));        
            if (row!=currentRow) {
                currentRow= row;
                listener.scrollChanged(row);
            } 
        };
        
        this.refresh= function() {
            setWithinBounds();
            drag.css("top", parseInt( (getHeight() - drag.height()-2)  / (totalRows-rows)*currentRow)+"px");
            listener.scrollChanged(currentRow);
        };

        function setWithinBounds() {
            if (currentRow<0)
                currentRow= 0;        
            if (currentRow>totalRows-rows)
                currentRow=rows>totalRows ? 0 : totalRows-rows;
        };

        this.down= function() {  this.move(1); };
        this.up= function() { this.move(-1); };        
        this.pageDown= function() { this.move(rows); };
        this.pageUp= function() { this.move(-rows);};
        this.first= function() { this.move(-currentRow); };
        this.last= function() { this.move(totalRows - rows);};
        this.move= function(delta) {
            currentRow+=delta;
            this.refresh();
        };
        
        $(document).ready(function() {
            drag.draggable({ 
                axis:'y',
                containment: 'parent',
                drag: function(event, ui) { instance.drag(event, ui); }       
            });
            drag.click(function(){ return false; });
            widget.find(".buttonup").click(function() {instance.up(); });
            widget.find(".buttondn").click(function() {instance.down(); });
            
            widget.find(".drag_container").click(function(e) {
                var y= e.clientY - drag.offset().top - 22; 
                if (y < drag.position().top)
                    instance.pageUp();
                else
                    instance.pageDown();
                return false;
            });                        
        });    
    };

    /*********************************************************************************************
                                        DataSource
    *********************************************************************************************/
    $.fn.zentable.DataSource= function(maxPageSize) {
        this.cols= new Array();
        this.totals= new Array();        

        this.setCols= function(cols) { this.cols= cols; };

        this.isDataReady= function() { return true; };

        this.setListener= function() {};
        
        this.dumpCSV= function(recipient) {
            recipient.empty();
            if(this.getSize() < 1000) maxPageSize = this.getSize();
            for (i = 0; i < maxPageSize; i++) {
                var row= this.getRow(i);
                for (j=0; row!=null && j<row.length; j++)
                    recipient.append((j>0 ? ",\"" : "\"") + row[j].replace("\"","\"\"") + "\"");
                recipient.append("<br>")
            }
        }        
    };

    $.fn.zentable.ArrayDataSource= function(array) {
        this.base= $.fn.zentable.DataSource;
        this.base();

        this.getSize= function() {
            return array.length;
        };

        this.getRow= function(row) {
            return array[row];
        };

        this.set= function(row, col, value) {
            array[row][col]= value;
        };        
    };


    $.fn.zentable.AJAXDataSource= function(href, pageSize,maxPageSize) {
        href= href.indexOf("?")==-1 ? href+"?" : href;
        this.base= $.fn.zentable.DataSource;
        this.base(maxPageSize);

        var order= "";
        var cache= new Array();
        var rowclasses= new Array();
        var instance= this;
        var totalRows= 0;
        var loading= false;
        pageSize== null ? 10 : pageSize;
        var fields= [];
        var filters= [];
        var ready= false;
        var listener= null;
        var dumpPending= null;

        this.refresh= function() {
            instance.clearCache();
            instance.loadPage(0);
        };

        this.setListener= function(l) {
            listener= l;
            listener.setLoading(loading);
        };

        this.setFilters= function(f) { filters= f; };

        this.setOrder= function(o) { order= o; };

        this.clearCache= function() { cache= new Array(); };

        this.isDataReady= function() { return ready; };

        this.processXML= function(response, stat) {
            var root= response.documentElement;
            totalRows= $(response).find("totalrows").text(); 

            var offset= $(response).find("offset").text();
            $(response).find("headers").find("col").each(function(i) { 
                instance.cols[i]= { 
                    name:$(this).text(),
                    id: $(this).attr("id"),
                    html:$(this).attr("html")!=null,
                    width: $(this).attr("width"),
                    editable: $(this).attr("editable")!="false",
                    orderable: $(this).attr("orderable")!="false",
                    clss: $(this).attr("class")==null ? '' : $(this).attr("class"),
                    hidden: $(this).attr("hidden")
                };
            });

            $(response).find("row").each(function(i) {
                cache[offset*1+i]= { 
                        values:new Array(), 
                        clss:$(this).attr("class") };
                        
                $(this).find("col").each(function(j) {
                    var t= $(this);
                    var tmp= instance.cols[j].html ? t.text() : t.text().split("<").join("&lt;").split(">").join("&gt;");
                    if (t.attr("link")!=null)
                        tmp= "<a href=\""+t.attr("link")+"\">" + tmp + "</a>";
                    cache[offset*1+i].values[j]= tmp;                   
                });            
            });
            $(response).find("totals").find("col").each(function(i) {
                instance.totals[i]= $(this).text();
            });
            listener.dataLoaded();
            loading= false;     
            listener.setLoading(false);       
            ready= true;
            
            if (dumpPending!=null) {
                this.dumpCSVParent(dumpPending);                
                dumpPending= null;
            }
        };

        this.sort= function(i) {
            var col= this.cols[i].id==null ? this.cols[i].name : this.cols[i].id;
            if (order==col)
                order= col+" desc";
            else
                order= col;
            listener.setOrderSign(i, new RegExp (" desc$").test(order));
            cache= new Array();
            this.loadPage(0);            
        };

        this.getSize= function() {
            return totalRows;
        };

        this.getRow= function(row) {
            if (row<totalRows && !cache[row] && !loading)
                this.loadPage(row);
            if (cache[row]==null)
                return null;
           return cache[row].values;
        };

        this.getRowClass= function(row) {
            if (cache[row]==null)
                return null;
            return cache[row].clss;
        };

        this.set= function(row, col, value) {       
        };

        this.loadPage= function(row) {
            loading= true;
            if (listener!=null)
                listener.setLoading(true);
        
            var filtSQL= '';
            for (i=0; i<filters.length; i++) {                
                var field= $("#"+filters[i]);
                if (field.length==0)  {
                    field= $("input[name="+filters[i]+"]");
		    if (field.length==0)
		        field= $("select[name="+filters[i]+"]");
                }

                var value= "";
                if (field.is("input[type=checkbox]"))
                    value= field.attr("checked") ? field.attr("value") : "";
                else                   
                    value= field.attr("value");
                filtSQL += "&"+ filters[i] + "=" + value;
            }
            var url= href+"&start="+row+"&pagesize="+pageSize+"&order="+order+filtSQL;

            $.ajax({
                type:"GET",
                url: url,
                dataType: "xml",
                success:function(data, stat) { instance.processXML(data); },
                error: function(req, stat, error) { alert("AJAX error: "+stat+". "+error+" URL="+url); }
             });
        };

        this.dumpCSVParent= this.dumpCSV;        
        this.dumpCSV = function(recipient) {
            var oldPageSize= pageSize;
            //pageSize= 1000;
            //pageSize = opts.csvMaxDump;
            pageSize = maxPageSize;
            this.dumpCSVParent($(recipient));
            pageSize= oldPageSize;
            dumpPending= recipient;
        }        
     
    };

}) (jQuery);

