$(function()
{
	function $(id) 
	{
		return document.getElementById(id);
	}
	
	function shape(x) 
	{
		if (x <= 9) return "0" + x;
		else return x.toString();
	}
	
	function LoadJs(newJS) 
	{
		var sObj = document.createElement("script");
		sObj.src = newJS;
		sObj.type = "text/javascript";
		document.getElementsByTagName("head")[0].appendChild(sObj);
	}
	
	
})