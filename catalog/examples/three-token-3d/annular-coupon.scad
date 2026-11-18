// Illustrative design, millimetres. Not a machine toolpath or qualified build file.
$fn = 128;
difference() {
  cylinder(h = 10, d = 12);
  translate([0, 0, -0.01]) cylinder(h = 10.02, d = 8);
}
